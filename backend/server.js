const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.post('/analyze-batch', async (req, res) => {
  try {
    console.log("🔥 PEDIDO CHEGOU AO SERVIDOR!");
    
    // Tenta extrair o base64 de qualquer propriedade do JSON recebido
    let base64 = null;
    if (req.body?.images?.[0]?.imageBase64) {
      base64 = req.body.images[0].imageBase64;
    } else if (req.body?.imageBase64) {
      base64 = req.body.imageBase64;
    } else {
      // Se vier em qualquer outra chave, pega a maior string
      const values = Object.values(req.body || {});
      const found = values.find(v => typeof v === 'string' && v.length > 100);
      if (found) base64 = found;
    }

    if (!base64) {
      console.log("❌ Corpo recebido era inválido:", JSON.stringify(req.body).substring(0, 100));
      return res.status(400).json({ error: 'Nenhuma imagem foi encontrada no pedido.' });
    }

    const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    
    const tempPath = path.join(__dirname, `temp_${Date.now()}.jpg`);
    fs.writeFileSync(tempPath, buffer);

    const scriptPath = path.join(__dirname, 'analisar.py');

    exec(`python3 "${scriptPath}" "${tempPath}"`, (err, stdout, stderr) => {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

      if (err) {
        console.error("❌ Erro Python:", stderr || err.message);
        return res.status(500).json({ error: 'Erro no processamento visual.' });
      }

      try {
        const jsonRes = JSON.parse(stdout.trim());
        console.log("✅ SUCESSO! Folhas medidas com OpenCV.");
        return res.json(jsonRes);
      } catch (e) {
        console.error("❌ Erro ao parsear JSON do Python:", stdout);
        return res.status(500).json({ error: 'Erro no formato de resposta.' });
      }
    });

  } catch (e) {
    console.error("❌ Erro crítico:", e);
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});

app.listen(3000, '0.0.0.0', () => {
  console.log('🚀 SERVIDOR DEFINITIVO A FUNCIONAR NA PORTA 3000');
});