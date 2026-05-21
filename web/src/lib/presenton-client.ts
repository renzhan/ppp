/**
 * Presenton API Client
 * 
 * 与自部署的 Presenton 实例通信，用于生成和编辑 PPT。
 * Presenton 通过 Docker 部署在本地或服务器上，提供 REST API。
 */

const PRESENTON_BASE_URL = process.env.PRESENTON_BASE_URL || 'http://localhost:5000';
const PRESENTON_USERNAME = process.env.PRESENTON_USERNAME || 'admin';
const PRESENTON_PASSWORD = process.env.PRESENTON_PASSWORD || 'admin123';

export interface GeneratePresentationRequest {
  content: string;
  n_slides?: number;
  language?: string;
  template?: string;
  tone?: 'default' | 'casual' | 'professional' | 'funny' | 'educational' | 'sales_pitch';
  verbosity?: 'concise' | 'standard' | 'text-heavy';
  instructions?: string;
  include_title_slide?: boolean;
  include_table_of_contents?: boolean;
  export_as?: 'pptx' | 'pdf' | 'png';
}

export interface PresentationResponse {
  presentation_id: string;
  path: string;
  edit_path: string;
}

export interface SlideEdit {
  index: number;
  content: Record<string, unknown>;
}

export interface EditPresentationRequest {
  presentation_id: string;
  slides: SlideEdit[];
  export_as?: 'pptx' | 'pdf';
}

export interface PresentationSlide {
  index: number;
  type: string;
  content: Record<string, unknown>;
  layout?: string;
}

export interface PresentationDetail {
  id: string;
  title: string;
  slides: PresentationSlide[];
  theme?: Record<string, unknown>;
}

export interface TemplateSummary {
  id: string;
  name: string;
}

class PresentonClient {
  private baseUrl: string;
  private authHeader: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || PRESENTON_BASE_URL;
    const credentials = Buffer.from(`${PRESENTON_USERNAME}:${PRESENTON_PASSWORD}`).toString('base64');
    this.authHeader = `Basic ${credentials}`;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.authHeader,
        ...options.headers,
      },
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Unknown error');
      throw new Error(`Presenton API error (${res.status}): ${errorText}`);
    }

    return res.json();
  }

  /**
   * 生成演示文稿（同步）
   * 将复盘报告内容发送给 Presenton，生成 PPT
   */
  async generatePresentation(req: GeneratePresentationRequest): Promise<PresentationResponse> {
    return this.request<PresentationResponse>('/api/v1/ppt/presentation/generate', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  /**
   * 获取演示文稿详情（包含所有幻灯片数据）
   */
  async getPresentation(presentationId: string): Promise<PresentationDetail> {
    return this.request<PresentationDetail>(`/api/v1/ppt/presentation/${presentationId}`);
  }

  /**
   * 编辑演示文稿中的指定幻灯片
   */
  async editPresentation(req: EditPresentationRequest): Promise<PresentationResponse> {
    return this.request<PresentationResponse>('/api/v1/ppt/presentation/edit', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  /**
   * 从已有演示文稿派生新版本（不修改原始）
   */
  async derivePresentation(req: EditPresentationRequest): Promise<PresentationResponse> {
    return this.request<PresentationResponse>('/api/v1/ppt/presentation/derive', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  /**
   * 导出演示文稿为 PPTX
   */
  async exportPptx(presentationId: string): Promise<{ path: string }> {
    return this.request<{ path: string }>(`/api/v1/ppt/presentation/export/pptx`, {
      method: 'POST',
      body: JSON.stringify({ presentation_id: presentationId }),
    });
  }

  /**
   * 获取可用模板列表
   */
  async getTemplates(): Promise<TemplateSummary[]> {
    return this.request<TemplateSummary[]>('/api/v1/ppt/presentation/templates');
  }

  /**
   * 获取 Presenton 编辑器的完整 URL（用于 iframe 嵌入）
   */
  getEditorUrl(presentationId: string): string {
    return `${this.baseUrl}/presentation?id=${presentationId}`;
  }

  /**
   * 获取导出文件的完整下载 URL
   */
  getDownloadUrl(path: string): string {
    if (path.startsWith('http')) return path;
    return `${this.baseUrl}${path}`;
  }

  /**
   * 健康检查 - 验证 Presenton 服务是否可用
   */
  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/ppt/presentation/generate`, {
        method: 'OPTIONS',
        headers: { 'Authorization': this.authHeader },
        signal: AbortSignal.timeout(5000),
      });
      // Any response that isn't a connection error means the service is up
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 下载 PPTX 文件为 Buffer
   * Presenton 将导出的 pptx 存储在 /app_data/exports/ 目录
   * 文件名格式: {sanitized-title}_{uuid}.pptx
   */
  async downloadPptx(presentationId: string): Promise<{ buffer: Buffer; filename: string }> {
    const detail = await this.getPresentation(presentationId);
    const title = (detail.title || 'presentation').replace(/[/\\?%*:|"<>]/g, '-');
    const filename = `${title}.pptx`;

    // 方法1: 从宿主机 app_data/exports 目录读取（Docker volume 映射）
    const { readdirSync, readFileSync } = await import('fs');
    const { join } = await import('path');

    const exportsDir = join(process.cwd(), '..', 'app_data', 'exports');
    try {
      const files = readdirSync(exportsDir).filter(f => f.endsWith('.pptx'));
      // 找到包含 presentationId 片段的文件
      const idPrefix = presentationId.substring(0, 8);
      let targetFile = files.find(f => f.includes(idPrefix));
      // 如果没找到，取最新的文件
      if (!targetFile && files.length > 0) {
        targetFile = files[files.length - 1];
      }
      if (targetFile) {
        const buf = readFileSync(join(exportsDir, targetFile));
        return { buffer: buf, filename };
      }
    } catch {
      // exports dir not accessible from this path, try alternative
    }

    // 方法2: 尝试从 Docker 容器内通过 /app_data/ URL 路径下载
    // Presenton nginx 映射了 /app_data/ 路径
    const url = `${this.baseUrl}/app_data/exports/`;
    try {
      // 直接用已知的文件名模式尝试
      const res = await fetch(url, { headers: { 'Authorization': this.authHeader } });
      if (res.ok) {
        const html = await res.text();
        const matches = html.match(/[^">\s]+\.pptx/g) || [];
        const idPrefix = presentationId.substring(0, 8);
        let targetFile = matches.find(f => f.includes(idPrefix));
        if (!targetFile && matches.length > 0) {
          targetFile = matches[matches.length - 1];
        }
        if (targetFile) {
          const fileRes = await fetch(`${this.baseUrl}/app_data/exports/${encodeURIComponent(targetFile)}`, {
            headers: { 'Authorization': this.authHeader },
          });
          if (fileRes.ok) {
            const buf = Buffer.from(await fileRes.arrayBuffer());
            return { buffer: buf, filename };
          }
        }
      }
    } catch {
      // URL approach failed
    }

    throw new Error('下载 PPTX 失败: 未找到导出文件，请尝试重新生成');
  }
}

// 单例导出
export const presentonClient = new PresentonClient();
export default PresentonClient;
