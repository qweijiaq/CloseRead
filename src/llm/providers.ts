export type LlmProviderId =
  | 'anthropic'
  | 'openai'
  | 'deepseek'
  | 'google'
  | 'alibaba'
  | 'xai'
  | 'glm'
  | 'moonshot'
  | 'custom'

export type LlmApi = 'openai' | 'anthropic'

export interface LlmModelOption {
  id: string
  label: string
  description?: string
}

export interface LlmProviderPreset {
  id: LlmProviderId
  label: string
  api: LlmApi
  baseUrl: string
  model: string
  keyEnv: string[]
  models: LlmModelOption[]
}

export const LLM_PROVIDERS: LlmProviderPreset[] = [
  {
    id: 'anthropic',
    label: 'Anthropic Claude',
    api: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-sonnet-5-5',
    keyEnv: ['ANTHROPIC_API_KEY'],
    models: [
      { id: 'claude-fable-5-1', label: 'Fable 5.1', description: '最强推理与代理能力，1M context' },
      { id: 'claude-opus-5-5', label: 'Opus 5.5', description: '复杂推理与写作' },
      { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5', description: '性能与成本平衡' },
      { id: 'claude-haiku-5-5', label: 'Haiku 5.5', description: '最快、最便宜' },
      { id: 'claude-sonnet-5', label: 'Sonnet 5', description: '上一代平衡档' },
      { id: 'claude-haiku-4-5', label: 'Haiku 4.5', description: '上一代轻量档' },
    ],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    api: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-5.6-sol',
    keyEnv: ['OPENAI_API_KEY'],
    models: [
      { id: 'gpt-6-astra', label: 'GPT-6 Astra', description: '最新旗舰' },
      { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol', description: '旗舰推理' },
      { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', description: '平衡档' },
      { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna', description: '低成本档' },
      { id: 'gpt-5.4-mini', label: 'GPT-5.4 Mini', description: '便宜的小模型' },
      { id: 'gpt-5.4-nano', label: 'GPT-5.4 Nano', description: '最便宜' },
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini', description: '兼容旧账户' },
    ],
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    api: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    keyEnv: ['DEEPSEEK_API_KEY'],
    models: [
      { id: 'deepseek-chat', label: 'DeepSeek Chat', description: '通用对话与写作' },
      { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner', description: '深度推理' },
      { id: 'deepseek-flash', label: 'DeepSeek Flash', description: '快速档' },
      { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro', description: '上一代旗舰' },
    ],
  },
  {
    id: 'google',
    label: 'Google Gemini',
    api: 'openai',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-3.8-flash',
    keyEnv: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    models: [
      { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', description: '最新快速档' },
      { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash', description: '快速档' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: '深度推理' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: '稳定快速档' },
    ],
  },
  {
    id: 'alibaba',
    label: '通义千问 Qwen',
    api: 'openai',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen3.8-flash',
    keyEnv: ['DASHSCOPE_API_KEY'],
    models: [
      { id: 'qwen3.8-max', label: 'Qwen 3.8 Max', description: '旗舰' },
      { id: 'qwen3.8-flash', label: 'Qwen 3.8 Flash', description: '快速档' },
      { id: 'qwen3.7-plus', label: 'Qwen 3.7 Plus', description: '平衡档' },
      { id: 'qwen3.7-flash', label: 'Qwen 3.7 Flash', description: '低成本' },
      { id: 'qwen3-coder-plus', label: 'Qwen3 Coder Plus', description: '代码向' },
      { id: 'qwen3-vl-plus', label: 'Qwen3 VL Plus', description: '视觉向' },
    ],
  },
  {
    id: 'xai',
    label: 'xAI Grok',
    api: 'openai',
    baseUrl: 'https://api.x.ai/v1',
    model: 'grok-4.6',
    keyEnv: ['XAI_API_KEY'],
    models: [
      { id: 'grok-4.6', label: 'Grok 4.6', description: '最新旗舰' },
      { id: 'grok-4.20', label: 'Grok 4.20', description: '推理档' },
      { id: 'grok-4.5', label: 'Grok 4.5', description: '平衡档' },
      { id: 'grok-4.3', label: 'Grok 4.3', description: '快速档' },
    ],
  },
  {
    id: 'glm',
    label: '智谱 GLM',
    api: 'openai',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-5.3-flash',
    keyEnv: ['GLM_API_KEY', 'ZHIPUAI_API_KEY'],
    models: [
      { id: 'glm-5.3', label: 'GLM-5.3', description: '旗舰' },
      { id: 'glm-5.3-flash', label: 'GLM-5.3 Flash', description: '快速档' },
      { id: 'glm-5.2', label: 'GLM-5.2', description: '上一代旗舰' },
      { id: 'glm-5', label: 'GLM-5', description: '稳定档' },
      { id: 'glm-4.7', label: 'GLM-4.7', description: '兼容旧账户' },
      { id: 'glm-4v', label: 'GLM-4V', description: '视觉向' },
    ],
  },
  {
    id: 'moonshot',
    label: 'Moonshot Kimi',
    api: 'openai',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'kimi-k2.6',
    keyEnv: ['MOONSHOT_API_KEY'],
    models: [
      { id: 'kimi-k3', label: 'Kimi K3', description: '新一代旗舰' },
      { id: 'kimi-k2.7-code', label: 'Kimi K2.7 Code', description: '代码向' },
      { id: 'kimi-k2.6', label: 'Kimi K2.6', description: '通用档' },
      { id: 'kimi-k2.5', label: 'Kimi K2.5', description: '兼容旧账户' },
    ],
  },
  {
    id: 'custom',
    label: '自定义 OpenAI 兼容',
    api: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    keyEnv: ['LEARN_API_KEY'],
    models: [],
  },
]

export function isLlmProvider(value: string): value is LlmProviderId {
  return LLM_PROVIDERS.some((provider) => provider.id === value)
}

const PROVIDER_ALIASES: Record<string, LlmProviderId> = {
  claude: 'anthropic',
  gemini: 'google',
  qwen: 'alibaba',
  dashscope: 'alibaba',
  zhipu: 'glm',
  kimi: 'moonshot',
}

export function normalizeLlmProvider(value: string): LlmProviderId | undefined {
  const normalized = value.trim().toLowerCase()
  if (isLlmProvider(normalized)) return normalized
  return PROVIDER_ALIASES[normalized]
}

export function providerPreset(id: string): LlmProviderPreset {
  return LLM_PROVIDERS.find((provider) => provider.id === id) ?? LLM_PROVIDERS[0]!
}
