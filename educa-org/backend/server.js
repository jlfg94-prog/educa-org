import Fastify from 'fastify';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Cargar variables de entorno desde el archivo .env
dotenv.config();

const fastify = Fastify({ logger: true });

// Inicializar el cliente de Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
  model: "gemini-flash-latest",
  generationConfig: {
    responseMimeType: "application/json"
  }
});

// 1. Cargar la ley y dividirla en trozos (párrafos)
const leyCompleta = fs.readFileSync(
  path.join(process.cwd(), 'assets', 'lomloe_andalucia.txt'),
  'utf-8'
);
// Dividimos el texto cada vez que haya un doble salto de línea
const fragmentosLey = leyCompleta.split(/\n+/);

fastify.post('/generar-actividad', async (request, reply) => {
  const { curso, asignatura, tema } = request.body;

  // 2. Crear las palabras clave a buscar (ej: "primaria", "matemáticas", "fracciones")
  const terminosBusqueda = `${curso} ${asignatura} ${tema}`
    .toLowerCase()
    .split(" ")
    .filter(palabra => palabra.length > 3); // Ignoramos "de", "el", "la"...

  // 3. Puntuar cada párrafo según cuántas palabras clave contenga
  const fragmentosRelevantes = fragmentosLey.map(fragmento => {
    let puntuacion = 0;
    const textoMin = fragmento.toLowerCase();
    
    terminosBusqueda.forEach(termino => {
      if (textoMin.includes(termino)) puntuacion++;
    });
    
    return { texto: fragmento, puntuacion };
  })
  .filter(f => f.puntuacion > 0)          
  .sort((a, b) => b.puntuacion - a.puntuacion)
  .slice(0, 10)                           
  .map(f => f.texto)
  .join('\n\n...\n\n');

  // Si el buscador falla, enviamos algo por defecto en lugar de vacío
  const contextoLegal = fragmentosRelevantes.length > 0 
    ? fragmentosRelevantes 
    : fragmentosLey.slice(0, 5).join('\n\n');

  console.log("➡️ Términos buscados:", terminosBusqueda);
  console.log("➡️ Líneas filtradas enviadas a Gemini:", contextoLegal.length > 500 ? "Demasiado largo!" : "Tamaño correcto");
  console.log("➡️ Tamaño del contexto en caracteres:", contextoLegal.length);
  
  // 4. Construimos el prompt inyectando SOLO el contexto filtrado
  const prompt = `
    Eres un experto pedagogo. Diseña una actividad educativa en formato JSON puro.
    
    <CONTEXTO_LEGAL>
    ${contextoLegal}
    </CONTEXTO_LEGAL>
    
    <PARÁMETROS>
    Curso: ${curso}
    Asignatura: ${asignatura}
    Tema: ${tema}
    </PARÁMETROS>
    
    Instrucciones:
    1. La actividad debe durar 45 minutos.
    2. Justifica legalmente la actividad basándote SOLO en el <CONTEXTO_LEGAL>.
    3. Devuelve estrictamente un JSON con esta estructura, sin bloques de código Markdown:
    {
      "titulo": "",
      "justificacion_legal": "",
      "desarrollo": ""
    }
  `;

  try {
    console.log("➡️ Enviando petición a Gemini...");
    const result = await model.generateContent(prompt);

    console.log("✅ Respuesta de Gemini recibida.");
    const responseText = result.response.text();
    console.log("➡️ Texto crudo devuelto:", responseText);

    // Limpieza segura
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const objetoJson = JSON.parse(cleanJson);

    console.log("✅ JSON procesado correctamente. Enviando al móvil...");
    return reply.status(200).send(objetoJson);

  } catch (error) {
    console.log("❌ ERROR CRÍTICO CAPTURADO:");
    console.error(error); // Imprimimos el error exacto en rojo
    return reply.status(500).send({ error: 'Error interno: ' + error.message });
  }
});

fastify.listen({ port: 3000, host: '0.0.0.0' }, (err) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info(`Servidor escuchando en http://0.0.0.0:3000`);
});