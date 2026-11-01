export type TtsProviderId = 'local' | 'edge' | 'glm' | 'gemini' | 'minimax' | 'elevenlabs' | 'openai' | 'custom'

export interface TtsProviderPreset {
  id: TtsProviderId
  label: string
  baseUrl: string
  model: string
  voice: string
  voices: string[]
  /** The provider understands a free-form tone/instruction field. */
  instructions: boolean
  hint: string
}

export const TTS_PROVIDERS: TtsProviderPreset[] = [
  {
    id: 'local',
    label: '本地系统语音',
    baseUrl: '',
    model: '',
    voice: '',
    voices: [],
    instructions: false,
    hint: '使用 macOS 已安装的声音，无需 Key；安装 Premium / Enhanced 后可在下方选择。',
  },
  {
    id: 'edge',
    label: 'Microsoft Edge 在线语音',
    baseUrl: '',
    model: '',
    voice: 'en-US-AvaNeural',
    voices: [
      'en-US-AvaNeural',
      'en-US-AriaNeural',
      'en-US-GuyNeural',
      'en-US-JennyNeural',
      'en-GB-SoniaNeural',
      'en-GB-RyanNeural',
      'en-AU-NatashaNeural',
    ],
    instructions: false,
    hint: '免 Key，在线调用 Microsoft Edge 朗读服务；需要联网，文本会发送到 Microsoft。',
  },
  {
    id: 'glm',
    label: '智谱 GLM-TTS',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-tts',
    voice: 'tongtong',
    voices: ['tongtong', 'chuichui', 'xiaochen', 'jam', 'kazi', 'douji', 'luodo'],
    instructions: false,
    hint: '智谱开放平台 Key；音色可填 tongtong、chuichui、xiaochen 等。',
  },
  {
    id: 'gemini',
    label: 'Google Gemini TTS',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-3.1-flash-tts-preview',
    voice: 'Kore',
    voices: ['Kore', 'Puck', 'Charon', 'Fenrir', 'Aoede', 'Leda', 'Orus', 'Zephyr'],
    instructions: true,
    hint: 'Google AI Studio Key；音色可填 Kore、Puck、Charon 等。',
  },
  {
    id: 'minimax',
    label: 'MiniMax Speech',
    baseUrl: 'https://api.minimaxi.com/v1',
    model: 'speech-02-hd',
    voice: 'female-shaonv',
    voices: ['female-shaonv', 'male-qn-qingse', 'female-yujie', 'male-qn-jingying'],
    instructions: false,
    hint: 'MiniMax 开放平台 Key；音色可填 female-shaonv、male-qn-qingse 等。',
  },
  {
    id: 'elevenlabs',
    label: 'ElevenLabs',
    baseUrl: 'https://api.elevenlabs.io/v1',
    model: 'eleven_multilingual_v2',
    voice: 'JBFqnCBsd6RMkjVDRZzb',
    voices: ['JBFqnCBsd6RMkjVDRZzb', 'pNInz6obpgDQGcFmaJgB', 'EXAVITQu4vr4xnSDxMaL', '21m00Tcm4TlvDq8ikWAM'],
    instructions: false,
    hint: 'ElevenLabs Key；音色填 Voice ID，可在 Voices 页面复制。',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini-tts',
    voice: 'nova',
    voices: ['nova', 'sage', 'coral', 'alloy', 'ash', 'echo', 'fable', 'onyx', 'shimmer'],
    instructions: true,
    hint: 'OpenAI 或 OpenAI 兼容的 /audio/speech 接口；音色可填 nova、sage、coral 等。',
  },
  {
    id: 'custom',
    label: '自定义兼容',
    baseUrl: 'https://api.example.com/v1',
    model: 'tts-1',
    voice: 'alloy',
    voices: [],
    instructions: true,
    hint: '填写任意 OpenAI 兼容的 /audio/speech 服务。',
  },
]

export function normalizeTtsProvider(value: unknown): TtsProviderId {
  const id = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return TTS_PROVIDERS.some((provider) => provider.id === id) ? (id as TtsProviderId) : 'openai'
}

export function ttsProviderPreset(id: TtsProviderId): TtsProviderPreset {
  return TTS_PROVIDERS.find((provider) => provider.id === id) ?? TTS_PROVIDERS[4]!
}
