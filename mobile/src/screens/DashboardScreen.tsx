import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  DashboardData,
  FaceResult,
  fetchDashboardData,
  imageUriFromBase64,
  RecognitionEvent,
  recognizeFace,
  registerFace,
  StoredFace,
  StoredPhoto,
} from '../api/client';
import { ActionButton } from '../components/ActionButton';
import { Section } from '../components/Section';
import { colors } from '../theme/styles';

const API_STORAGE_KEY = '@raspberry-pi-face-api-url';
const DEFAULT_API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:8000';

type PickedImage = {
  uri: string;
  base64: string;
};

type TabKey = 'recognitions' | 'faces' | 'photos';

function formatDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

async function ensureCameraPermission() {
  const current = await ImagePicker.getCameraPermissionsAsync();
  if (current.granted) return true;
  const requested = await ImagePicker.requestCameraPermissionsAsync();
  return requested.granted;
}

async function ensureLibraryPermission() {
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (current.granted) return true;
  const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return requested.granted;
}

async function pickImage(source: 'camera' | 'library'): Promise<PickedImage | null> {
  const hasPermission = source === 'camera' ? await ensureCameraPermission() : await ensureLibraryPermission();
  if (!hasPermission) {
    Alert.alert('Permissao necessaria', 'Autorize o acesso para selecionar ou capturar imagens.');
    return null;
  }

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({
          allowsEditing: false,
          base64: true,
          quality: 0.8,
        })
      : await ImagePicker.launchImageLibraryAsync({
          allowsEditing: false,
          base64: true,
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
        });

  if (result.canceled || !result.assets[0]?.base64) return null;
  return {
    uri: result.assets[0].uri,
    base64: result.assets[0].base64,
  };
}

export function DashboardScreen() {
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [savedApiUrl, setSavedApiUrl] = useState(DEFAULT_API_URL);
  const [data, setData] = useState<DashboardData>({ photos: [], faces: [], recognitions: [] });
  const [activeTab, setActiveTab] = useState<TabKey>('recognitions');
  const [refreshing, setRefreshing] = useState(false);
  const [busyAction, setBusyAction] = useState<'recognize' | 'register' | null>(null);
  const [statusMessage, setStatusMessage] = useState('Conecte na API e carregue os dados.');
  const [recognizeImage, setRecognizeImage] = useState<PickedImage | null>(null);
  const [registerImage, setRegisterImage] = useState<PickedImage | null>(null);
  const [faceName, setFaceName] = useState('');

  const latestRecognition = data.recognitions[0];
  const recognizedNames = useMemo(() => {
    const names = latestRecognition?.recognition_result?.recognized?.map((face) => face.name).filter(Boolean);
    return names?.length ? names.join(', ') : 'Sem reconhecimento confirmado';
  }, [latestRecognition]);

  const loadData = useCallback(
    async (nextApiUrl = savedApiUrl) => {
      setRefreshing(true);
      try {
        const result = await fetchDashboardData(nextApiUrl);
        setData(result);
        setStatusMessage('Dados atualizados.');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao carregar dados';
        setStatusMessage(message);
      } finally {
        setRefreshing(false);
      }
    },
    [savedApiUrl],
  );

  useEffect(() => {
    AsyncStorage.getItem(API_STORAGE_KEY).then((storedUrl) => {
      const nextUrl = storedUrl || DEFAULT_API_URL;
      setApiUrl(nextUrl);
      setSavedApiUrl(nextUrl);
      loadData(nextUrl);
    });
  }, [loadData]);

  async function saveApiUrl() {
    const nextUrl = apiUrl.trim().replace(/\/+$/, '');
    if (!nextUrl) {
      Alert.alert('URL obrigatoria', 'Informe a URL da API FastAPI.');
      return;
    }

    await AsyncStorage.setItem(API_STORAGE_KEY, nextUrl);
    setSavedApiUrl(nextUrl);
    setApiUrl(nextUrl);
    await loadData(nextUrl);
  }

  async function handleRecognize() {
    if (!recognizeImage) {
      Alert.alert('Imagem obrigatoria', 'Capture ou selecione uma foto para reconhecer.');
      return;
    }

    setBusyAction('recognize');
    try {
      const result = await recognizeFace(savedApiUrl, recognizeImage.base64);
      setStatusMessage(result.message || 'Reconhecimento concluido.');
      await loadData(savedApiUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha no reconhecimento';
      setStatusMessage(message);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRegister() {
    if (!faceName.trim()) {
      Alert.alert('Nome obrigatorio', 'Informe o nome da pessoa.');
      return;
    }
    if (!registerImage) {
      Alert.alert('Imagem obrigatoria', 'Capture ou selecione uma foto do rosto.');
      return;
    }

    setBusyAction('register');
    try {
      const result = await registerFace(savedApiUrl, faceName.trim(), registerImage.base64);
      setStatusMessage(result.message || 'Face cadastrada.');
      setFaceName('');
      setRegisterImage(null);
      await loadData(savedApiUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha no cadastro';
      setStatusMessage(message);
    } finally {
      setBusyAction(null);
    }
  }

  async function chooseImage(target: 'recognize' | 'register', source: 'camera' | 'library') {
    const picked = await pickImage(source);
    if (!picked) return;
    if (target === 'recognize') {
      setRecognizeImage(picked);
    } else {
      setRegisterImage(picked);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={screenStyles.container}>
      <ScrollView
        contentContainerStyle={screenStyles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData()} tintColor={colors.primary} />}
      >
        <View style={screenStyles.header}>
          <View style={screenStyles.brandRow}>
            <View style={screenStyles.logo}>
              <Ionicons color="#ffffff" name="scan" size={24} />
            </View>
            <View style={screenStyles.brandText}>
              <Text style={screenStyles.kicker}>Raspberry Pi Face</Text>
              <Text style={screenStyles.owner}>Matheus Silvano Pereira</Text>
            </View>
          </View>
          <Text style={screenStyles.title}>Reconhecimento facial no Android</Text>
          <Text style={screenStyles.subtitle}>Cadastre rostos, envie capturas e acompanhe o historico da API FastAPI.</Text>
        </View>

        <Section
          eyebrow="Conexao"
          title="API do backend"
          action={
            <Pressable accessibilityRole="button" onPress={() => loadData()} style={screenStyles.iconButton}>
              <Ionicons color={colors.primary} name="refresh" size={20} />
            </Pressable>
          }
        >
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            onChangeText={setApiUrl}
            placeholder="http://10.0.2.2:8000"
            placeholderTextColor="#8a94a6"
            style={screenStyles.input}
            value={apiUrl}
          />
          <ActionButton
            icon={<Ionicons color={colors.primaryDark} name="save-outline" size={18} />}
            label="Salvar e testar conexao"
            onPress={saveApiUrl}
            variant="secondary"
          />
          <View style={screenStyles.statusBox}>
            <Ionicons color={colors.primary} name="radio-outline" size={18} />
            <Text style={screenStyles.statusText}>{statusMessage}</Text>
          </View>
        </Section>

        <Section eyebrow="Captura" title="Enviar foto para reconhecer">
          <ImagePreview imageUri={recognizeImage?.uri} fallback="Sem captura selecionada" />
          <View style={screenStyles.buttonGrid}>
            <ActionButton
              icon={<Ionicons color="#ffffff" name="camera-outline" size={18} />}
              label="Camera"
              onPress={() => chooseImage('recognize', 'camera')}
            />
            <ActionButton
              icon={<Ionicons color={colors.text} name="images-outline" size={18} />}
              label="Galeria"
              onPress={() => chooseImage('recognize', 'library')}
              variant="ghost"
            />
          </View>
          <ActionButton
            disabled={!recognizeImage}
            label="Reconhecer pessoa"
            loading={busyAction === 'recognize'}
            onPress={handleRecognize}
          />
        </Section>

        <Section eyebrow="Cadastro" title="Adicionar pessoa">
          <TextInput
            onChangeText={setFaceName}
            placeholder="Nome da pessoa"
            placeholderTextColor="#8a94a6"
            style={screenStyles.input}
            value={faceName}
          />
          <ImagePreview imageUri={registerImage?.uri} fallback="Sem rosto selecionado" />
          <View style={screenStyles.buttonGrid}>
            <ActionButton
              icon={<Ionicons color="#ffffff" name="camera-outline" size={18} />}
              label="Camera"
              onPress={() => chooseImage('register', 'camera')}
            />
            <ActionButton
              icon={<Ionicons color={colors.text} name="images-outline" size={18} />}
              label="Galeria"
              onPress={() => chooseImage('register', 'library')}
              variant="ghost"
            />
          </View>
          <ActionButton
            disabled={!registerImage || !faceName.trim()}
            label="Cadastrar face"
            loading={busyAction === 'register'}
            onPress={handleRegister}
          />
        </Section>

        <Section eyebrow="Resumo" title="Ultimo reconhecimento">
          <View style={screenStyles.summaryGrid}>
            <Metric label="Mensagem" value={latestRecognition?.recognition_result?.message || '-'} />
            <Metric label="Reconhecidos" value={recognizedNames} />
          </View>
          <ImagePreview
            fallback="Nenhum evento processado"
            imageUri={imageUriFromBase64(latestRecognition?.image_base64)}
          />
          <FaceList faces={latestRecognition?.recognition_result?.faces || []} />
        </Section>

        <Section eyebrow="Historico" title="Eventos recentes">
          <View style={screenStyles.tabs}>
            <TabButton active={activeTab === 'recognitions'} label="Reconhecimentos" onPress={() => setActiveTab('recognitions')} />
            <TabButton active={activeTab === 'faces'} label="Faces" onPress={() => setActiveTab('faces')} />
            <TabButton active={activeTab === 'photos'} label="Fotos" onPress={() => setActiveTab('photos')} />
          </View>
          {activeTab === 'recognitions' ? <RecognitionList events={data.recognitions} /> : null}
          {activeTab === 'faces' ? <RegisteredFaceList faces={data.faces} /> : null}
          {activeTab === 'photos' ? <PhotoList photos={data.photos} /> : null}
        </Section>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ImagePreview({ imageUri, fallback }: { imageUri?: string; fallback: string }) {
  if (!imageUri) {
    return (
      <View style={screenStyles.emptyPreview}>
        <Ionicons color={colors.muted} name="image-outline" size={26} />
        <Text style={screenStyles.emptyText}>{fallback}</Text>
      </View>
    );
  }

  return <Image resizeMode="cover" source={{ uri: imageUri }} style={screenStyles.previewImage} />;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={screenStyles.metric}>
      <Text style={screenStyles.metricLabel}>{label}</Text>
      <Text style={screenStyles.metricValue}>{value}</Text>
    </View>
  );
}

function FaceList({ faces }: { faces: FaceResult[] }) {
  if (!faces.length) {
    return <Text style={screenStyles.mutedText}>Nenhuma pessoa detectada nessa captura.</Text>;
  }

  return (
    <View style={screenStyles.list}>
      {faces.map((face, index) => (
        <View key={`${face.message}-${index}`} style={screenStyles.listItem}>
          <Ionicons
            color={face.status === 'recognized' ? colors.success : colors.warning}
            name={face.status === 'recognized' ? 'checkmark-circle-outline' : 'help-circle-outline'}
            size={20}
          />
          <View style={screenStyles.listText}>
            <Text style={screenStyles.itemTitle}>{face.message}</Text>
            {typeof face.confidence === 'number' ? (
              <Text style={screenStyles.itemMeta}>Confianca: {(face.confidence * 100).toFixed(1)}%</Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

function TabButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[screenStyles.tabButton, active && screenStyles.activeTabButton]}
    >
      <Text style={[screenStyles.tabLabel, active && screenStyles.activeTabLabel]}>{label}</Text>
    </Pressable>
  );
}

function RecognitionList({ events }: { events: RecognitionEvent[] }) {
  if (!events.length) return <Text style={screenStyles.mutedText}>Nenhum reconhecimento salvo ainda.</Text>;

  return (
    <View style={screenStyles.list}>
      {events.slice(0, 12).map((event) => (
        <View key={event.id} style={screenStyles.historyItem}>
          <Image resizeMode="cover" source={{ uri: imageUriFromBase64(event.image_base64) }} style={screenStyles.thumb} />
          <View style={screenStyles.listText}>
            <Text style={screenStyles.itemTitle}>{event.recognition_result?.message || 'Reconhecimento'}</Text>
            <Text style={screenStyles.itemMeta}>{formatDate(event.created_at)}</Text>
            <Text style={screenStyles.itemMeta}>
              {(event.recognition_result?.recognized || []).map((face) => face.name).filter(Boolean).join(', ') ||
                'Sem reconhecimento confirmado'}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function RegisteredFaceList({ faces }: { faces: StoredFace[] }) {
  if (!faces.length) return <Text style={screenStyles.mutedText}>Nenhuma face cadastrada ainda.</Text>;

  return (
    <View style={screenStyles.list}>
      {faces.map((face) => (
        <View key={face.id} style={screenStyles.listItem}>
          <Ionicons color={colors.primary} name="person-circle-outline" size={22} />
          <View style={screenStyles.listText}>
            <Text style={screenStyles.itemTitle}>{face.name}</Text>
            <Text style={screenStyles.itemMeta}>Cadastro ativo desde {formatDate(face.created_at)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function PhotoList({ photos }: { photos: StoredPhoto[] }) {
  if (!photos.length) return <Text style={screenStyles.mutedText}>Nenhuma foto recebida ainda.</Text>;

  return (
    <View style={screenStyles.list}>
      {photos.slice(0, 12).map((photo) => (
        <View key={photo.id} style={screenStyles.historyItem}>
          <Image resizeMode="cover" source={{ uri: imageUriFromBase64(photo.image_base64) }} style={screenStyles.thumb} />
          <View style={screenStyles.listText}>
            <Text style={screenStyles.itemTitle}>Foto recebida</Text>
            <Text style={screenStyles.itemMeta}>{formatDate(photo.created_at)}</Text>
            <Text numberOfLines={2} style={screenStyles.itemMeta}>
              {JSON.stringify(photo.photo_metadata || {})}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const screenStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    gap: 14,
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    gap: 12,
    paddingTop: 8,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  logo: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  brandText: {
    flex: 1,
  },
  kicker: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  owner: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    color: colors.text,
    fontSize: 31,
    fontWeight: '900',
    lineHeight: 36,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  statusBox: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },
  statusText: {
    color: colors.text,
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  buttonGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  emptyPreview: {
    alignItems: 'center',
    aspectRatio: 1.35,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: 8,
    borderStyle: 'dashed',
    borderWidth: 1,
    gap: 8,
    justifyContent: 'center',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  previewImage: {
    aspectRatio: 1.35,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    width: '100%',
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  metric: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    flex: 1,
    gap: 5,
    padding: 12,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  metricValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
  },
  mutedText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  tabs: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    flexDirection: 'row',
    padding: 4,
  },
  tabButton: {
    alignItems: 'center',
    borderRadius: 7,
    flex: 1,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  activeTabButton: {
    backgroundColor: colors.surface,
  },
  tabLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  activeTabLabel: {
    color: colors.primaryDark,
  },
  list: {
    gap: 10,
  },
  listItem: {
    alignItems: 'flex-start',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  historyItem: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 10,
    padding: 10,
  },
  listText: {
    flex: 1,
    gap: 3,
  },
  itemTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
  },
  itemMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  thumb: {
    backgroundColor: colors.border,
    borderRadius: 8,
    height: 62,
    width: 62,
  },
});
