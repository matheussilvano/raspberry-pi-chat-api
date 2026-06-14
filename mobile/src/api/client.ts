export type FaceResult = {
  status: 'recognized' | 'unrecognized';
  name?: string;
  confidence?: number;
  message: string;
};

export type RecognitionPayload = {
  message: string;
  faces: FaceResult[];
  recognized: FaceResult[];
};

export type RecognitionEvent = {
  id: number;
  image_base64: string;
  recognition_result: RecognitionPayload;
  created_at: string;
};

export type StoredFace = {
  id: number;
  name: string;
  created_at: string;
};

export type StoredPhoto = {
  id: number;
  image_base64: string;
  photo_metadata: Record<string, unknown>;
  created_at: string;
};

export type DashboardData = {
  photos: StoredPhoto[];
  faces: StoredFace[];
  recognitions: RecognitionEvent[];
};

function trimBaseUrl(value: string) {
  return value.replace(/\/+$/, '');
}

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof data?.detail === 'string' ? data.detail : 'Falha na requisicao';
    throw new Error(detail);
  }
  return data as T;
}

export async function fetchDashboardData(apiUrl: string): Promise<DashboardData> {
  const baseUrl = trimBaseUrl(apiUrl);
  const [photos, faces, recognitions] = await Promise.all([
    fetch(`${baseUrl}/photos`).then((response) => parseResponse<StoredPhoto[]>(response)),
    fetch(`${baseUrl}/faces`).then((response) => parseResponse<StoredFace[]>(response)),
    fetch(`${baseUrl}/recognitions`).then((response) => parseResponse<RecognitionEvent[]>(response)),
  ]);

  return { photos, faces, recognitions };
}

export async function registerFace(apiUrl: string, name: string, imageBase64: string) {
  const body = new FormData();
  body.append('name', name);
  body.append('image_base64', imageBase64);

  const response = await fetch(`${trimBaseUrl(apiUrl)}/register_face`, {
    method: 'POST',
    body,
  });

  return parseResponse<{ message: string; face_id: number }>(response);
}

export async function recognizeFace(apiUrl: string, imageBase64: string) {
  const body = new FormData();
  body.append('image_base64', imageBase64);

  const response = await fetch(`${trimBaseUrl(apiUrl)}/recognize_face`, {
    method: 'POST',
    body,
  });

  return parseResponse<RecognitionPayload>(response);
}

export function imageUriFromBase64(value?: string | null) {
  if (!value) return undefined;
  return value.startsWith('data:') ? value : `data:image/jpeg;base64,${value}`;
}
