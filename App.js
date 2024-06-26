import {useCallback, useEffect, useState} from 'react';
import {
  Button,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LiveAudioStream from 'react-native-live-audio-stream';
import {Buffer} from 'buffer';
import WebSocket from 'react-native-websocket';
import {io} from 'socket.io-client';

const requestMicrophonePermission = async () => {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission',
          message: 'App needs access to your microphone to record audio.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn(err);
      return false;
    }
  }
  return true;
};

const socket = io('wss://1cef-183-91-15-7.ngrok-free.app');

export default function App() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [ws, setWs] = useState(null);
  const [transcription, setTranscription] = useState('');
  let timeoutEnd;

  useEffect(() => {
    socket.on('connect', () => {
      console.log('SOCKER ID', socket.id); // "G5p5..."
    });
    socket.on(`transcription_${socket.id}`, data => {
      console.log('SOCKET', data.text);
      clearTimeout(timeoutEnd);
      timeoutEnd = setTimeout(stopStreaming, 5000);
      setTranscription(data.text);
    });

    // Handle error
    socket.on(`error_${socket.id}`, data => {});

    return () => {
      socket.off('transcription');
    };
  }, [socket.id]);

  useEffect(() => {
    (async () => {
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) {
        alert('Microphone permission is required to use this feature.');
      }
    })();
  }, []);

  const startStreaming = () => {
    setTranscription('');
    LiveAudioStream.init({
      sampleRate: 16000,
      channels: 1,
      bitsPerSample: 16,
      audioSource: 6,
      bufferSize: 14400,
    });
    LiveAudioStream.start();
    socket.emit('control_transcript', {id: socket.id, action: 'START'});

    LiveAudioStream.on('data', async data => {
      try {
        let chunk = Buffer.from(data, 'base64');
        socket.emit('audio_chunk', socket.id, chunk);
        console.log('CHUNK RECEIVE');
      } catch (error) {
        console.log('STREAM ERROR', error);
      }
    });
    setIsStreaming(true);
  };
  const stopStreaming = () => {
    LiveAudioStream.stop();
    setIsStreaming(false);
    socket.emit('control_transcript', {id: socket.id, action: 'END'});
  };

  return (
    <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
      <Text>Live Audio Stream Example</Text>
      <Button
        title={isStreaming ? 'Stop Streaming' : 'Start Streaming'}
        onPress={isStreaming ? stopStreaming : startStreaming}
      />
      <Text>Transcription: {transcription}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
