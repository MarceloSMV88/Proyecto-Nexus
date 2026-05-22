export type MatCategory = 'Material' | 'Servicio' | 'Software' | 'RRHH' | 'Otro';
export type MatStatus = 'Activo' | 'Pendiente' | 'En revisión' | 'Inactivo';

export interface MaterialServicio {
  id: string;
  project_id?: string | null;
  name: string;
  category: MatCategory;
  supplier?: string | null;
  unit: string;
  unit_price: number;
  quantity: number;
  status: MatStatus;
  notes?: string | null;
  created_at?: string;
}
