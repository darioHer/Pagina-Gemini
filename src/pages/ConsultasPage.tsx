import React, { useState, useEffect } from 'react';
import { 
  Search, 
  RotateCcw, 
  AlertCircle, 
  Loader2, 
  CheckCircle2, 
  Clock, 
  User, 
  Calendar, 
  Droplets, 
  Trash2, 
  Lightbulb, 
  Filter,
  ChevronRight
} from 'lucide-react';
import { DetalleConsultaPage } from './DetalleConsultaPage';

export interface PQRSItem {
  id: string;
  solicitante: string;
  categoria: string;
  descripcion: string;
  estado: 'En trámite' | 'Resuelto' | string;
  fechaRadicacion: string;
  plazoLegal: string;
  respuestaOficial: string;
}

export interface ConsultasPageProps {
  initialRadicadoId?: string | null;
  initialSearchTerm?: string;
  onSelectRadicado?: (id: string) => void;
}

export const ConsultasPage: React.FC<ConsultasPageProps> = ({
  initialRadicadoId = null,
  initialSearchTerm = '',
  onSelectRadicado
}) => {
  const [pqrsList, setPqrsList] = useState<PQRSItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>(initialSearchTerm);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [selectedItem, setSelectedItem] = useState<PQRSItem | null>(null);

  const fetchPqrsData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/pqrs');
      if (!response.ok) {
        throw new Error(`Servidor devolvió estado HTTP ${response.status}`);
      }
      const data: PQRSItem[] = await response.json();
      setPqrsList(data);

      if (initialRadicadoId) {
        const found = data.find(item => item.id.toLowerCase() === initialRadicadoId.toLowerCase());
        if (found) setSelectedItem(found);
      }
    } catch (err) {
      setError(
        err instanceof Error 
          ? err.message 
          : 'No se pudo conectar con el servicio backend de PQRS.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPqrsData();
  }, [initialRadicadoId]);

  if (selectedItem) {
    return (
      <DetalleConsultaPage 
        itemData={selectedItem} 
        onBack={() => setSelectedItem(null)} 
      />
    );
  }

  const filteredPqrs = pqrsList.filter((item) => {
    const matchesSearch = 
      item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.solicitante.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.categoria.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = 
      selectedCategory === 'Todas' || item.categoria === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const getCategoryIcon = (categoria: string) => {
    const lower = categoria.toLowerCase();
    if (lower.includes('agua')) return <Droplets size={16} />;
    if (lower.includes('basura')) return <Trash2 size={16} />;
    if (lower.includes('alumbrado')) return <Lightbulb size={16} />;
    return <Filter size={16} />;
  };

  const handleCardClick = (item: PQRSItem) => {
    setSelectedItem(item);
    if (onSelectRadicado) {
      onSelectRadicado(item.id);
    }
  };

  return (
    <div className="consultas-clean-wrapper">
      {/* Header Conciso */}
      <div className="page-header-clean">
        <div>
          <h2 className="page-title-clean">Consulta Pública de Trámites y PQRS</h2>
          <p className="page-subtitle-clean">
            Rastrea el estado, dependencia asignada y respuesta oficial de las peticiones radicadas.
          </p>
        </div>
      </div>

      {/* Barra de Búsqueda y Filtro de Categoría */}
      <div className="consultas-search-row">
        <div className="search-bar-clean" style={{ flex: 1 }}>
          <Search size={18} className="search-icon-clean" />
          <input
            type="text"
            className="search-input-clean"
            placeholder="Buscar por código de radicado, solicitante o palabra clave..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="category-select-wrapper">
          <Filter size={16} color="#64748b" />
          <select
            className="select-clean-inline"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="Todas">Todas las Categorías</option>
            <option value="Agua y Alcantarillado">Agua y Alcantarillado</option>
            <option value="Recolección de Basura">Recolección de Basura</option>
            <option value="Alumbrado Público">Alumbrado Público</option>
            <option value="Tránsito y Movilidad">Tránsito y Movilidad</option>
          </select>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="empty-state-clean">
          <Loader2 size={36} className="spinner-icon" color="var(--azul-institucional)" />
          <h4>Cargando radicados...</h4>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="empty-state-clean">
          <AlertCircle size={36} color="#ef4444" />
          <h4>Error al cargar registros</h4>
          <p>{error}</p>
          <button type="button" className="btn-action-primary-clean" onClick={fetchPqrsData} style={{ marginTop: '0.5rem' }}>
            <RotateCcw size={15} />
            <span>Reintentar</span>
          </button>
        </div>
      )}

      {/* Results grid */}
      {!loading && !error && filteredPqrs.length === 0 ? (
        <div className="empty-state-clean">
          <Search size={36} color="#94a3b8" />
          <h4>No se encontraron trámites</h4>
          <p>Intenta con otro número de radicado o elimina los filtros de búsqueda.</p>
        </div>
      ) : !loading && !error && (
        <div className="filings-grid-clean">
          {filteredPqrs.map((item) => {
            const isResuelto = item.estado === 'Resuelto';

            return (
              <div 
                key={item.id} 
                className="filing-card-clean clickable"
                onClick={() => handleCardClick(item)}
              >
                <div className="filing-card-top">
                  <span className="filing-code-pill">{item.id}</span>
                  <span className={`status-pill ${isResuelto ? 'status-resuelto' : 'status-tramite'}`}>
                    {isResuelto ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                    <span>{item.estado}</span>
                  </span>
                </div>

                <div className="filing-card-content">
                  <span className="filing-category-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    {getCategoryIcon(item.categoria)}
                    <span>{item.categoria} • Plazo: {item.plazoLegal}</span>
                  </span>
                  <h3 className="filing-title">{item.descripcion}</h3>
                  <div className="filing-user-row">
                    <User size={13} />
                    <span>{item.solicitante}</span>
                  </div>
                </div>

                <div className="filing-card-bottom">
                  <span className="filing-date-text">
                    <Calendar size={13} />
                    <span>{item.fechaRadicacion}</span>
                  </span>

                  <button type="button" className="btn-view-cert-clean">
                    <span>Ver Detalle</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
export default ConsultasPage;
