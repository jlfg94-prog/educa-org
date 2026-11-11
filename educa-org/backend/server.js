import Fastify from 'fastify';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import cors from '@fastify/cors';

// Cargar variables de entorno desde el archivo .env
dotenv.config();

const fastify = Fastify({ logger: true });
fastify.register(cors, {
  origin: '*', 
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
});

// Inicializar el cliente de Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 1. Cargar la ley y dividirla en trozos (párrafos)
const leyCompleta = fs.readFileSync(
  path.join(process.cwd(), 'assets', 'lomloe_andalucia.txt'),
  'utf-8'
);
const fragmentosLey = leyCompleta.split(/\n+/);

fastify.post('/generar-actividad', async (request, reply) => {
  const { curso, asignatura, tema, detalles } = request.body;

  console.log("📥 Datos recibidos del frontend:", { curso, asignatura, tema, detalles });

  // 2. Crear las palabras clave a buscar (SIN 'detalles' para no ensuciar la búsqueda legal)
  const terminosBusqueda = `${curso} ${asignatura} ${tema}`
    .toLowerCase()
    .split(" ")
    .filter(palabra => palabra.length > 3);

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

  const contextoLegal = fragmentosRelevantes.length > 0 
    ? fragmentosRelevantes 
    : fragmentosLey.slice(0, 5).join('\n\n');

  const requisitoDocente = detalles && detalles.trim() !== ""
    ? detalles.trim()
    : "Incluye entre 4 y 6 ejercicios prácticos variados sobre el tema.";

  // 4. Construimos el prompt reforzando el requisito dentro del propio campo ficha_html
  const prompt = `
    Eres un experto pedagogo. Diseña una actividad educativa en formato JSON puro.
    
    <CONTEXTO_LEGAL>
    ${contextoLegal}
    </CONTEXTO_LEGAL>
    
    <PARÁMETROS>
    Curso: ${curso}
    Asignatura: ${asignatura}
    Tema: ${tema}
    Formato/Requisitos exigidos por el docente: ${requisitoDocente}
    </PARÁMETROS>
    
    Instrucciones obligatorias:
    1. La actividad debe durar 45 minutos.
    2. Justifica legalmente la actividad basándote SOLO en el <CONTEXTO_LEGAL>.
    3. En la ficha imprimible ("ficha_html"), CUMPLE ESTRICTAMENTE lo pedido en "Formato/Requisitos exigidos por el docente": "${requisitoDocente}". Si pide una lectura comprensiva, redacta el texto completo de lectura y sus preguntas; si pide un examen o un número exacto de actividades, incluye exactamente esa cantidad y formato.
    4. Devuelve estrictamente un JSON con esta estructura, sin bloques de código Markdown:
    {
      "titulo": "",
      "justificacion_legal": "",
      "desarrollo": "",
      "ficha_html": "Documento HTML5 completo con CSS en etiqueta <style> listo para imprimir en A4 (fondo blanco, cabecera con Nombre y Fecha). DEBE CONTENER OBLIGATORIAMENTE: ${requisitoDocente}. Usa CSS limpio para cuadrículas, textos de lectura o cajas de respuesta, y decora con emojis infantiles."
    }
  `;

  try {
    const MODELOS_DISPONIBLES = [
      "gemini-2.5-flash-lite",
      "gemini-2.5-flash",
      "gemini-1.5-flash"
    ];

    let result = null;
    let ultimoError = null;

    for (const nombreModelo of MODELOS_DISPONIBLES) {
      try {
        console.log(`➡️ Probando petición con el modelo: ${nombreModelo}...`);
        const model = genAI.getGenerativeModel({ 
          model: nombreModelo,
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.7
          }
        });

        result = await model.generateContent(prompt);
        console.log(`✅ Respuesta obtenida con éxito de ${nombreModelo}`);
        break;
      } catch (err) {
        console.warn(`⚠️ Falló ${nombreModelo} (${err.status || err.message}). Saltando al siguiente...`);
        ultimoError = err;
      }
    }

    if (!result) {
      throw ultimoError;
    }

    const responseText = result.response.text();

    // Limpieza segura
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const objetoJson = JSON.parse(cleanJson);

    console.log("✅ JSON procesado correctamente. Enviando al móvil...");
    return reply.status(200).send(objetoJson);

  } catch (error) {
    console.log("❌ ERROR CRÍTICO CAPTURADO:");
    console.error(error);
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
