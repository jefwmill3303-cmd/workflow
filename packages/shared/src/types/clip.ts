export type ClipStatus = 'draft' | 'published' | 'archived';

export interface Clip {
  id: string;
  title: string;
  description?: string;
  url: string;
  status: ClipStatus;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export interface CreateClipDto {
  title: string;
  description?: string;
  url: string;
  tags?: string[];
}

export interface UpdateClipDto {
  title?: string;
  description?: string;
  url?: string;
  status?: ClipStatus;
  tags?: string[];
}
