import sys
import json
import os
import warnings
warnings.filterwarnings('ignore')

import cv2
import numpy as np

def analisar_folhas(image_path):
    imagem = cv2.imread(image_path)
    if imagem is None:
        raise Exception(f"Não foi possível ler a imagem no caminho: {image_path}")

    hsv = cv2.cvtColor(imagem, cv2.COLOR_BGR2HSV)
    altura_img, largura_img = imagem.shape[:2]
    
    # ====================================================
    # CALIBRAÇÃO ESTÁVEL DA RÉGUA DE 1 METRO
    # ====================================================
    # 78% da altura útil da imagem corresponde à régua vertical de 1 metro
    altura_util_regua_px = altura_img * 0.78
    pixels_por_cm = altura_util_regua_px / 100.0
    largura_faixa_regua = int(largura_img * 0.22)

    # ====================================================
    # SEGMENTAÇÃO DE COR (VERDES E TONS DE BROTOS/ÁPICE)
    # ====================================================
    lower_green = np.array([10, 12, 12])
    upper_green = np.array([95, 255, 255])
    mascara_verde = cv2.inRange(hsv, lower_green, upper_green)

    lower_red1 = np.array([0, 15, 15])
    upper_red1 = np.array([15, 255, 255])
    mascara_red1 = cv2.inRange(hsv, lower_red1, upper_red1)

    lower_red2 = np.array([165, 15, 15])
    upper_red2 = np.array([180, 255, 255])
    mascara_red2 = cv2.inRange(hsv, lower_red2, upper_red2)

    mascara_cor = cv2.bitwise_or(mascara_verde, mascara_red1)
    mascara_cor = cv2.bitwise_or(mascara_cor, mascara_red2)
    
    # Exclui a área da régua amarela à direita da contagem de folhas
    mascara_cor[:, largura_img - largura_faixa_regua:] = 0
    
    # ====================================================
    # SEPARAÇÃO AVANÇADA DE FOLHAS COLADAS (WATERSHED)
    # ====================================================
    kernel = np.ones((3, 3), np.uint8)
    mascara_cor = cv2.morphologyEx(mascara_cor, cv2.MORPH_OPEN, kernel, iterations=1)
    mascara_cor = cv2.dilate(mascara_cor, kernel, iterations=1)

    # Transformação de distância para encontrar os centros de cada folha
    dist_transform = cv2.distanceTransform(mascara_cor, cv2.DIST_L2, 5)
    _, sure_fg = cv2.threshold(dist_transform, 0.15 * dist_transform.max(), 255, 0)
    sure_fg = np.uint8(sure_fg)

    # Criação de marcadores para recortar folhas sobrepostas
    _, markers = cv2.connectedComponents(sure_fg)
    markers = markers + 1
    
    sure_bg = cv2.dilate(mascara_cor, kernel, iterations=3)
    unknown = cv2.subtract(sure_bg, sure_fg)
    markers[unknown == 255] = 0

    markers = cv2.watershed(imagem, markers)
    
    folhas = []
    contador = 1

    for label in range(2, markers.max() + 1):
        mascara_individual = np.zeros(mascara_cor.shape, dtype=np.uint8)
        mascara_individual[markers == label] = 255

        contornos, _ = cv2.findContours(mascara_individual, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contornos:
            continue
            
        contorno = max(contornos, key=cv2.contourArea)
        area_px_raw = cv2.contourArea(contorno)
        
        # Filtro de área sensível para aceitar folhinhas e brotos miúdos do ápice
        if area_px_raw < 15: 
            continue

        rect = cv2.minAreaRect(contorno)
        largura_px, altura_px = rect[1]
        
        comprimento_px = max(largura_px, altura_px)
        largura_folha_px = min(largura_px, altura_px)

        comprimento_cm = comprimento_px / pixels_por_cm
        largura_cm = largura_folha_px / pixels_por_cm

        # Filtros biológicos rigorosos para evitar ruídos e falsos positivos
        if comprimento_cm > 15.0 or comprimento_cm < 0.8:
            continue
        if largura_cm > 8.0 or largura_cm < 0.2:
            continue

        folhas.append({
            "id": contador,
            "length": round(comprimento_cm, 2),
            "width": round(largura_cm, 2),
            "area": round((area_px_raw / (pixels_por_cm ** 2)), 2)
        })
        contador += 1

    return folhas

if __name__ == "__main__":
    try:
        if len(sys.argv) < 2:
            print(json.dumps({"error": "Caminho da imagem não fornecido"}))
            sys.exit(1)
        
        img_path = sys.argv[1]
        resultado = analisar_folhas(img_path)
        total_leaves = len(resultado)
        
        if total_leaves > 0:
            lengths = [f["length"] for f in resultado]
            widths = [f["width"] for f in resultado]
            avg_length = round(sum(lengths) / total_leaves, 2)
            avg_width = round(sum(widths) / total_leaves, 2)
            max_length = round(max(lengths), 2)
            min_length = round(min(lengths), 2)
        else:
            avg_length = avg_width = max_length = min_length = 0.0

        resposta_final = {
            "totalUniqueLeaves": total_leaves,
            "avgLength": avg_length,
            "avgWidth": avg_width,
            "maxLength": max_length,
            "minLength": min_length,
            "leavesDetails": resultado
        }
        print(json.dumps(resposta_final))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)