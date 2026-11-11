import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  ScrollView,
  Share,
  Platform
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export default function App() {
  const [curso, setCurso] = useState('');
  const [asignatura, setAsignatura] = useState('');
  const [tema, setTema] = useState('');
  const [detalles, setDetalles] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);

  const generarActividad = async () => {
    // Validación básica
    if (!curso || !asignatura || !tema || !detalles) {
      setError('Por favor, rellena todos los campos.');
      return;
    }

    setLoading(true);
    setError(null);
    setResultado(null);

    try {
          const response = await fetch('https://educa-org.onrender.com/generar-actividad', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ curso, asignatura, tema, detalles }),
          });

        if (!response.ok) {
          throw new Error('Error en la comunicación con el servidor');
        }

        const data = await response.json();
        setResultado(data);
        
      } catch (err) {
        setError(err.message || 'Hubo un problema al conectar con el backend.');
      } finally {
        setLoading(false);
      }
    };

  const compartirActividad = async () => {
    if (!resultado) return;

    // Formateamos el texto con asteriscos para que WhatsApp lo ponga en negrita
    const mensaje = `*${resultado.titulo}*\n\n*Justificación Legal:*\n${resultado.justificacion_legal}\n\n*Desarrollo Paso a Paso:*\n${resultado.desarrollo}`;

    try {
      await Share.share({
        message: mensaje,
      });
    } catch (error) {
      console.error("Error al compartir:", error.message);
    }
  };
  
const generarPDF = async () => {
    if (!resultado || !resultado.ficha_html) {
      alert("La ficha aún no está lista. Genera una actividad nueva.");
      return;
    }

    try {
      if (Platform.OS === 'web') {
        // Abre una pestaña nueva exclusivamente con el diseño HTML de Gemini y lanza su impresión
        const ventanaImpresion = window.open('', '_blank');
        ventanaImpresion.document.write(resultado.ficha_html);
        ventanaImpresion.document.close();
        ventanaImpresion.focus();
        setTimeout(() => {
          ventanaImpresion.print();
          ventanaImpresion.close();
        }, 500);
      } else {
        // En Android (cuando Sara use la app instalada), crea el PDF físico y abre WhatsApp/compartir
        const { uri } = await Print.printToFileAsync({ html: resultado.ficha_html });
        await Sharing.shareAsync(uri);
      }
    } catch (error) {
      console.error("Error al generar PDF:", error);
    }
  };
  
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Generador de Actividades</Text>

      <View style={styles.form}>
        <Text style={styles.label}>Curso:</Text>
        <TextInput 
          style={styles.input} 
          placeholder="Ej: 3º de Primaria" 
          value={curso} 
          onChangeText={setCurso} 
        />

        <Text style={styles.label}>Asignatura:</Text>
        <TextInput 
          style={styles.input} 
          placeholder="Ej: Conocimiento del Medio" 
          value={asignatura} 
          onChangeText={setAsignatura} 
        />

        <Text style={styles.label}>Tema:</Text>
        <TextInput 
          style={styles.input} 
          placeholder="Ej: Los ecosistemas" 
          value={tema} 
          onChangeText={setTema} 
        />

        <Text style={styles.label}>Formato o detalles de la ficha (Opcional):</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: Lectura comprensiva, Examen de 5 preguntas, 8 sumas..."
          value={detalles}
          onChangeText={setDetalles}
        />
        

        <TouchableOpacity 
          style={styles.button} 
          onPress={generarActividad}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Generando...' : 'Crear Actividad'}
          </Text>
        </TouchableOpacity>

        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      {/* Indicador de carga */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0066cc" />
          <Text style={styles.loadingText}>Analizando normativa...</Text>
        </View>
      )}

    {resultado && (
      <View style={styles.resultContainer}>
        <Text style={styles.resultTitle}>{resultado.titulo}</Text>

        <Text style={styles.sectionTitle}>Justificación Legal</Text>
        <Text style={styles.resultText}>{resultado.justificacion_legal}</Text>

        <Text style={styles.sectionTitle}>Desarrollo Paso a Paso</Text>
        <Text style={styles.resultText}>{resultado.desarrollo}</Text>

        <TouchableOpacity 
          style={styles.shareButton} 
          onPress={compartirActividad}
        >
          <Text style={styles.shareButtonText}>Compartir por WhatsApp</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.shareButton, { backgroundColor: '#d32f2f', marginTop: 10 }]} 
          onPress={generarPDF}
        >
          <Text style={styles.shareButtonText}>Descargar Ficha en PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.anotherButton} 
          onPress={generarActividad}
          disabled={loading}
        >
          <Text style={styles.anotherButtonText}>🔄 Generar otra variante</Text>
        </TouchableOpacity>
      </View>
    )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 80,
    backgroundColor: '#f5f5f5',
    paddingTop: 60,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#333',
    textAlign: 'center',
  },
  anotherButton: {
    backgroundColor: '#6c757d', // Un tono gris elegante
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  anotherButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  form: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    color: '#555',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#0066cc',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  shareButton: {
    backgroundColor: '#25D366', // Color verde oficial de WhatsApp
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#d32f2f',
    marginTop: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  loadingContainer: {
    marginTop: 32,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 16,
  },
  resultContainer: {
    marginTop: 24,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0066cc',
    marginTop: 12,
    marginBottom: 6,
  },
  resultText: {
    fontSize: 15,
    color: '#444',
    lineHeight: 22,
  },
});
