import * as dotenv from 'dotenv';
dotenv.config();

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error("❌ No se ha encontrado la GEMINI_API_KEY en el archivo .env");
    return;
  }

  console.log("Consultando modelos disponibles en tu cuenta...");
  
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    
    if (data.error) {
      console.error("Error de la API:", data.error.message);
      return;
    }

    console.log("\n✅ Nombres exactos que puedes usar en tu server.js:");
    data.models
      // Filtramos solo los que sirven para generar texto
      .filter(m => m.supportedGenerationMethods.includes("generateContent"))
      .forEach(m => console.log(`👉 ${m.name.replace('models/', '')}`));
      
  } catch (error) {
    console.error("Error de conexión:", error);
  }
}

listModels();