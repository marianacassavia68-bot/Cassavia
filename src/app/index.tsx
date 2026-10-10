import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';

import { Image as ExpoImage } from 'expo-image';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

const { width, height } = Dimensions.get('window');

const SERVER_URL = 'https://cassavia.onrender.com';

export default function FieldMeasurementScreen() {
  const [showIntro, setShowIntro] = useState(true);

  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);

  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [plantAnalysis, setPlantAnalysis] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [manualVisible, setManualVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'camera'>('dashboard');

  const dashboardStats = {
    totalAnalises: 14,
    mediaFolhas: 8.5,
    historicoRecente: [
      { id: '1', data: 'Ontem', folhas: 6, maxComp: '12.4 cm' },
      { id: '2', data: 'Hoje', folhas: 9, maxComp: '14.1 cm' },
      { id: '3', data: 'Hoje', folhas: 11, maxComp: '15.8 cm' },
    ],
  };

  const processPlantImages = async (uris: string[]) => {
    if (uris.length === 0) {
      alert('Nenhuma foto foi selecionada.');
      return;
    }

    setAnalyzing(true);
    setPlantAnalysis(null);

    try {
      const base64 = await FileSystem.readAsStringAsync(uris[0], {
        encoding: FileSystem.EncodingType.Base64,
      });

      const payload = {
        images: [
          {
            imageBase64: base64,
            mimeType: 'image/jpeg',
            imageIndex: 0,
          }
        ]
      };

      const response = await fetch(`${SERVER_URL}/analyze-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(`Erro no servidor: ${response.status}\n\n${responseText}`);
      }

      let result;
      try {
        result = JSON.parse(responseText);
      } catch {
        throw new Error('O servidor não retornou um JSON válido.\n\n' + responseText);
      }

      setPlantAnalysis(result);

    } catch (error: any) {
      alert('Erro na análise da planta:\n\n' + (error?.message || 'Erro desconhecido'));
    } finally {
      setAnalyzing(false);
    }
  };

  const capturePhoto = async () => {
    if (!cameraRef.current) {
      alert('A câmera ainda não está pronta.');
      return;
    }

    try {
      const photo = await cameraRef.current.takePictureAsync({
        skipProcessing: false,
        quality: 0.8,
      });

      if (!photo?.uri) {
        throw new Error('Não foi possível capturar a foto.');
      }

      setCapturedPhotos((previous) => [...previous, photo.uri]);

    } catch (error: any) {
      alert('Erro ao tirar foto:\n\n' + (error?.message || 'Erro desconhecido'));
    }
  };

  const pickImagesFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'] as any,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedUris = result.assets.map((asset) => asset.uri);
        setCapturedPhotos((previous) => [...previous, ...selectedUris]);
      }
    } catch (error: any) {
      alert('Erro ao selecionar imagens:\n\n' + (error?.message || 'Erro desconhecido'));
    }
  };

  const exportarRelatorio = async (dadosRelatorio: any) => {
    try {
      let conteudoCSV = "ID,Comprimento(cm),Largura(cm),Area(cm2)\n";
      
      dadosRelatorio.leavesDetails.forEach((folha: any) => {
        conteudoCSV += `${folha.id},${folha.length},${folha.width},${folha.area}\n`;
      });

      conteudoCSV += `\nResumo Geral:\n`;
      conteudoCSV += `Total de Folhas: ${dadosRelatorio.totalUniqueLeaves}\n`;
      conteudoCSV += `Comprimento Médio: ${dadosRelatorio.avgLength} cm\n`;
      conteudoCSV += `Largura Média: ${dadosRelatorio.avgWidth} cm\n`;
      conteudoCSV += `Maior Folha: ${dadosRelatorio.maxLength} cm\n`;
      conteudoCSV += `Menor Folha: ${dadosRelatorio.minLength} cm\n`;

      const caminhoFicheiro = `${FileSystem.documentDirectory}relatorio_cassavia.csv`;

      await FileSystem.writeAsStringAsync(caminhoFicheiro, conteudoCSV, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(caminhoFicheiro);
      } else {
        alert("A partilha não está disponível neste dispositivo.");
      }
    } catch (erro) {
      alert("Não foi possível exportar o relatório.");
    }
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <View style={styles.permissionCard}>
          <Text style={styles.permissionIcon}>📷</Text>
          <Text style={styles.permissionTitle}>Acesso à Câmara</Text>
          <Text style={styles.message}>
            Precisamos de acesso à câmara para fotografar e medir com precisão as folhas em campo.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Permitir Câmara</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* TELA DE INTRODUÇÃO INTERATIVA */}
      {showIntro && (
        <TouchableOpacity 
          style={styles.introOverlay} 
          activeOpacity={1} 
          onPress={() => setShowIntro(false)}
        >
          <ExpoImage 
            source={require('../../assets/images/intro_lab.jpg')} 
            style={styles.introImage} 
            contentFit="cover"
          />
          <View style={styles.introPromptContainer}>
            <Text style={styles.introPromptText}>Toque em qualquer lugar para começar ✨</Text>
          </View>
        </TouchableOpacity>
      )}

      {activeTab === 'dashboard' ? (
        <SafeAreaView style={styles.container}>
          <ScrollView contentContainerStyle={styles.dashboardContainer} showsVerticalScrollIndicator={false}>
            {/* CABEÇALHO MODERNO */}
            <View style={styles.headerDashboard}>
              <View>
                <View style={styles.badgeWelcome}>
                  <Text style={styles.badgeWelcomeText}>🌿 Laboratório de Pesquisa</Text>
                </View>
                <Text style={styles.welcomeTitle}>Cassavia Plant Lab</Text>
              </View>

              <TouchableOpacity
                style={styles.manualIconBtn}
                onPress={() => setManualVisible(true)}
              >
                <Text style={styles.manualIconText}>?</Text>
              </TouchableOpacity>
            </View>

            {/* CARTÃO DE ESTATÍSTICAS E GRÁFICO */}
            <View style={styles.cardChart}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.chartTitle}>📊 Desempenho de Análises</Text>
                <View style={styles.liveDot} />
              </View>
              <Text style={styles.chartSubtitle}>Média de folhas detetadas por sessão em campo</Text>

              <View style={styles.barGraphContainer}>
                {dashboardStats.historicoRecente.map((item, index) => {
                  const barHeight = item.folhas * 12;
                  return (
                    <View key={index} style={styles.barColumn}>
                      <Text style={styles.barValueText}>{item.folhas}</Text>
                      <View
                        style={[
                          styles.barFill,
                          { height: barHeight > 12 ? barHeight : 12 },
                        ]}
                      />
                      <Text style={styles.barLabelText}>{item.data}</Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statBadge}>
                  <Text style={styles.statBadgeNum}>{dashboardStats.totalAnalises}</Text>
                  <Text style={styles.statBadgeLabel}>Análises Totais</Text>
                </View>
                <View style={styles.statBadge}>
                  <Text style={styles.statBadgeNum}>{dashboardStats.mediaFolhas}</Text>
                  <Text style={styles.statBadgeLabel}>Média / Amostra</Text>
                </View>
              </View>
            </View>

            {/* BOTÕES DE AÇÃO PRINCIPAIS */}
            <View style={styles.actionsWrapper}>
              <TouchableOpacity
                style={styles.primaryActionButton}
                onPress={() => {
                  setCapturedPhotos([]);
                  setPlantAnalysis(null);
                  setActiveTab('camera');
                }}
              >
                <Text style={styles.primaryActionIcon}>📸</Text>
                <View style={styles.primaryActionTextContainer}>
                  <Text style={styles.primaryActionText}>Abrir Câmara & Analisar</Text>
                  <Text style={styles.primaryActionSubtext}>Capturar nova planta em campo</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryActionButton}
                onPress={pickImagesFromGallery}
              >
                <Text style={styles.secondaryActionIcon}>📁</Text>
                <View style={styles.primaryActionTextContainer}>
                  <Text style={styles.secondaryActionText}>Importar da Galeria</Text>
                  <Text style={styles.secondaryActionSubtext}>Selecionar registos salvos</Text>
                </View>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* MODAL DE MANUAL */}
          <Modal visible={manualVisible} animationType="fade" transparent={true}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeaderBar}>
                  <Text style={styles.modalTitle}>📖 Guia Cassavia Lab</Text>
                  <TouchableOpacity onPress={() => setManualVisible(false)}>
                    <Text style={styles.modalCloseX}>✕</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                  <View style={styles.stepItemBox}>
                    <Text style={styles.stepNum}>1</Text>
                    <Text style={styles.modalStep}>Painel de controlo interativo com estatísticas consolidadas de campo.</Text>
                  </View>
                  <View style={styles.stepItemBox}>
                    <Text style={styles.stepNum}>2</Text>
                    <Text style={styles.modalStep}>Sistema de visão computacional otimizado para medição automatizada de folhas.</Text>
                  </View>
                  <View style={styles.stepItemBox}>
                    <Text style={styles.stepNum}>3</Text>
                    <Text style={styles.modalStep}>Geração e exportação instantânea de relatórios detalhados em formato CSV.</Text>
                  </View>
                </ScrollView>
                <TouchableOpacity
                  style={styles.closeModalButton}
                  onPress={() => setManualVisible(false)}
                >
                  <Text style={styles.closeModalButtonText}>Compreendido</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      ) : (
        <View style={styles.container}>
          <CameraView style={styles.absoluteCamera} facing={facing} ref={cameraRef} />

          <SafeAreaView style={styles.overlayUI}>
            <View style={styles.topBar}>
              <TouchableOpacity
                style={styles.manualButton}
                onPress={() => {
                  setActiveTab('dashboard');
                  setCapturedPhotos([]);
                  setPlantAnalysis(null);
                }}
              >
                <Text style={styles.manualButtonText}>← Voltar ao Painel</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.centerContainer}>
              {analyzing ? (
                <View style={styles.resultBoxLoading}>
                  <ActivityIndicator size="large" color="#34d399" />
                  <Text style={styles.loadingText}>
                    Processando lote de {capturedPhotos.length} imagens...
                  </Text>
                </View>
              ) : plantAnalysis ? (
                <ScrollView style={styles.resultBoxContainer} contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
                  <View style={styles.resultBox}>
                    <Text style={styles.resultHeader}>🌳 Relatório de Análise Científica</Text>
                    
                    <View style={styles.summaryHighlightCard}>
                      <View style={styles.summaryMetricItem}>
                        <Text style={styles.summaryMetricValue}>{capturedPhotos.length}</Text>
                        <Text style={styles.summaryMetricLabel}>Fotos</Text>
                      </View>
                      <View style={styles.summaryDivider} />
                      <View style={styles.summaryMetricItem}>
                        <Text style={styles.summaryMetricValue}>{plantAnalysis?.totalUniqueLeaves ?? 0}</Text>
                        <Text style={styles.summaryMetricLabel}>Folhas</Text>
                      </View>
                    </View>

                    <Text style={styles.subHeader}>📊 Métricas Médias do Lote</Text>
                    <View style={styles.metricsGrid}>
                      <View style={styles.metricCardMini}>
                        <Text style={styles.metricCardVal}>{plantAnalysis?.avgLength ?? 'N/A'} cm</Text>
                        <Text style={styles.metricCardLbl}>Comp. Médio</Text>
                      </View>
                      <View style={styles.metricCardMini}>
                        <Text style={styles.metricCardVal}>{plantAnalysis?.avgWidth ?? 'N/A'} cm</Text>
                        <Text style={styles.metricCardLbl}>Larg. Média</Text>
                      </View>
                    </View>

                    <View style={styles.extremesRow}>
                      <Text style={styles.resultItem}>Maior: <Text style={styles.highlightLarge}>{plantAnalysis?.maxLength ?? 'N/A'} cm</Text></Text>
                      <Text style={styles.resultItem}>Menor: <Text style={styles.highlightLarge}>{plantAnalysis?.minLength ?? 'N/A'} cm</Text></Text>
                    </View>

                    <TouchableOpacity
                      style={styles.exportButton}
                      onPress={() => exportarRelatorio(plantAnalysis)}
                    >
                      <Text style={styles.exportButtonText}>📥 Exportar Relatório Oficial (CSV)</Text>
                    </TouchableOpacity>

                    <Text style={styles.subHeader}>🌿 Detalhes Individuais por Folha</Text>
                    {plantAnalysis?.leavesDetails && plantAnalysis.leavesDetails.length > 0 ? (
                      plantAnalysis.leavesDetails.map((leaf: any, index: number) => (
                        <View key={index} style={styles.leafDetailRow}>
                          <Text style={styles.leafIdText}>Folha #{leaf.id || index + 1}</Text>
                          <View style={styles.leafMetricsRowInner}>
                            <Text style={styles.leafMetricText}>Comp: <Text style={styles.leafValue}>{leaf.length} cm</Text></Text>
                            <Text style={styles.leafMetricText}>Larg: <Text style={styles.leafValue}>{leaf.width} cm</Text></Text>
                          </View>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.resultItem}>Nenhum detalhe individual retornado.</Text>
                    )}

                    <TouchableOpacity
                      style={styles.retakeButton}
                      onPress={() => {
                        setCapturedPhotos([]);
                        setPlantAnalysis(null);
                      }}
                    >
                      <Text style={styles.retakeButtonText}>🔄 Realizar Nova Captura</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              ) : (
                <View style={styles.guideBox}>
                  <View style={styles.guideBadge}>
                    <Text style={styles.guideBadgeText}>Modo de Captura Ativo</Text>
                  </View>
                  <Text style={styles.guideText}>
                    Enquadre as folhas no guia pontilhado ou selecione da galeria ({capturedPhotos.length} prontas)
                  </Text>
                </View>
              )}
            </View>

            {!plantAnalysis && !analyzing && (
              <View style={styles.bottomBarContainer}>
                <TouchableOpacity
                  style={styles.galleryButton}
                  onPress={pickImagesFromGallery}
                >
                  <Text style={styles.galleryButtonText}>📁 Galeria</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.captureButton}
                  onPress={capturePhoto}
                >
                  <View style={styles.innerCaptureButton} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.finishButton,
                    capturedPhotos.length === 0 && { opacity: 0.5 },
                  ]}
                  disabled={capturedPhotos.length === 0}
                  onPress={() => processPlantImages(capturedPhotos)}
                >
                  <Text style={styles.finishButtonText}>
                    ✓ Finalizar ({capturedPhotos.length})
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </SafeAreaView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050b14',
  },
  introOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: width,
    height: height,
    zIndex: 9999,
    backgroundColor: '#000',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 60,
  },
  introImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: width,
    height: height,
  },
  introPromptContainer: {
    backgroundColor: 'rgba(5, 11, 20, 0.85)',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: '#34d399',
    zIndex: 10000,
    shadowColor: '#34d399',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
  },
  introPromptText: {
    color: '#34d399',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  dashboardContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  headerDashboard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 10,
  },
  badgeWelcome: {
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.2)',
  },
  badgeWelcomeText: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '600',
  },
  welcomeTitle: {
    color: '#f8fafc',
    fontSize: 26,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  manualIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#1e293b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  manualIconText: {
    color: '#34d399',
    fontSize: 20,
    fontWeight: 'bold',
  },
  cardChart: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 22,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chartTitle: {
    color: '#f1f5f9',
    fontSize: 17,
    fontWeight: 'bold',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34d399',
  },
  chartSubtitle: {
    color: '#64748b',
    fontSize: 13,
    marginBottom: 20,
  },
  barGraphContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 150,
    backgroundColor: '#050b14',
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 10,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
  },
  barValueText: {
    color: '#34d399',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  barFill: {
    width: 28,
    backgroundColor: '#2563eb',
    borderRadius: 8,
  },
  barLabelText: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 8,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  statBadge: {
    flex: 1,
    backgroundColor: '#050b14',
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  statBadgeNum: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: 'bold',
  },
  statBadgeLabel: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  actionsWrapper: {
    gap: 12,
  },
  primaryActionButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryActionIcon: {
    fontSize: 26,
    marginRight: 16,
  },
  primaryActionTextContainer: {
    flex: 1,
  },
  primaryActionText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
  primaryActionSubtext: {
    color: '#93c5fd',
    fontSize: 13,
    marginTop: 2,
  },
  secondaryActionButton: {
    backgroundColor: '#0f172a',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#1e293b',
  },
  secondaryActionIcon: {
    fontSize: 26,
    marginRight: 16,
  },
  secondaryActionText: {
    color: '#f1f5f9',
    fontSize: 17,
    fontWeight: 'bold',
  },
  secondaryActionSubtext: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 2,
  },
  absoluteCamera: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: width,
    height: height,
  },
  overlayUI: {
    flex: 1,
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#050b14',
  },
  permissionCard: {
    backgroundColor: '#0f172a',
    padding: 30,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
    width: '100%',
    maxWidth: 360,
  },
  permissionIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  permissionTitle: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
    paddingBottom: 24,
    color: '#94a3b8',
    fontSize: 15,
    lineHeight: 22,
  },
  permissionButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
  },
  permissionButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  topBar: {
    paddingHorizontal: 20,
    alignItems: 'flex-start',
    marginTop: 10,
    zIndex: 10,
  },
  manualButton: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  manualButtonText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    paddingHorizontal: 20,
  },
  guideBox: {
    borderWidth: 2,
    borderColor: '#34d399',
    borderStyle: 'dashed',
    width: '85%',
    height: '65%',
    justifyContent: 'flex-start',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(5, 11, 20, 0.3)',
    padding: 15,
  },
  guideBadge: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
    marginBottom: 10,
  },
  guideBadgeText: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: 'bold',
  },
  guideText: {
    color: '#cbd5e1',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  bottomBarContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 35,
    paddingHorizontal: 20,
    zIndex: 10,
    backgroundColor: 'rgba(5, 11, 20, 0.75)',
    paddingTop: 15,
  },
  galleryButton: {
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#1e293b',
  },
  galleryButtonText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
  },
  captureButton: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderColor: '#fff',
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  innerCaptureButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
  },
  finishButton: {
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#4ade80',
  },
  finishButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  resultBoxContainer: {
    width: '100%',
    maxHeight: '88%',
  },
  resultBox: {
    backgroundColor: '#0f172a',
    padding: 22,
    borderRadius: 22,
    width: '100%',
    borderWidth: 1,
    borderColor: '#1e293b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  resultBoxLoading: {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  resultHeader: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  summaryHighlightCard: {
    flexDirection: 'row',
    backgroundColor: '#050b14',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
  },
  summaryMetricItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryMetricValue: {
    color: '#34d399',
    fontSize: 22,
    fontWeight: 'bold',
  },
  summaryMetricLabel: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  summaryDivider: {
    width: 1,
    height: '70%',
    backgroundColor: '#1e293b',
  },
  subHeader: {
    color: '#f1f5f9',
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 10,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  metricCardMini: {
    flex: 1,
    backgroundColor: '#050b14',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
  },
  metricCardVal: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
  },
  metricCardLbl: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  extremesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#050b14',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  resultItem: {
    color: '#94a3b8',
    fontSize: 13,
  },
  highlightLarge: {
    color: '#34d399',
    fontWeight: 'bold',
  },
  loadingText: {
    color: '#cbd5e1',
    marginTop: 14,
    textAlign: 'center',
    fontSize: 15,
  },
  exportButton: {
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginVertical: 6,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  leafDetailRow: {
    backgroundColor: '#050b14',
    padding: 12,
    borderRadius: 12,
    marginVertical: 5,
    borderWidth: 1,
    borderColor: '#1e293b',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leafIdText: {
    color: '#34d399',
    fontWeight: 'bold',
    fontSize: 14,
  },
  leafMetricsRowInner: {
    flexDirection: 'row',
    gap: 12,
  },
  leafMetricText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  leafValue: {
    color: '#f8fafc',
    fontWeight: 'bold',
  },
  retakeButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    marginTop: 18,
  },
  retakeButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#0f172a',
    width: '100%',
    maxHeight: '80%',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  modalHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  modalTitle: {
    color: '#f8fafc',
    fontSize: 19,
    fontWeight: 'bold',
  },
  modalCloseX: {
    color: '#94a3b8',
    fontSize: 20,
    fontWeight: 'bold',
    paddingHorizontal: 6,
  },
  modalScroll: {
    marginBottom: 18,
  },
  stepItemBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#050b14',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  stepNum: {
    backgroundColor: '#2563eb',
    color: '#fff',
    width: 24,
    height: 24,
    borderRadius: 12,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: 'bold',
    fontSize: 12,
    marginRight: 10,
    overflow: 'hidden',
  },
  modalStep: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  closeModalButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  closeModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});