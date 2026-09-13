import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Sparkles, 
  Filter, 
  ChevronRight, 
  X, 
  Loader2 
} from 'lucide-react';
import { searchNormativasSemantica } from '../services/supabaseService';
import type { NormativaItem } from '../services/supabaseService';

export const NormativasPage: React.FC = () => {
  const [queryText, setQueryText] = useState<string>('');
  const [selectedCategoria, setSelectedCategoria] = useState<string>('Todas');
  const [normativasList, setNormativasList] = useState<NormativaItem[]>([]);
  const [selectedNormativa, setSelectedNormativa] = useState<NormativaItem | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchNormativas = async () => {
    setLoading(true);
    try {
      const results = await searchNormativasSemantica(queryText, selectedCategoria);
      setNormativasList(results);
    } catch (e) {
      console.error('Error in semantic search for normatives:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNormativas();
  }, [selectedCategoria]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchNormativas();
  };

  const handlePromptClick = (prompt: string) => {
    setQueryText(prompt);
    setLoading(true);
    searchNormativasSemantica(prompt, selectedCategoria)
      .then(res => setNormativasList(res))
      .finally(() => setLoading(false));
  };

  return (
    <div className="normativas-clean-wrapper">
      {/* Header Conciso */}
      <div className="page-header-clean">
        <div>
          <h2 className="page-title-clean">Normatividad y Reglamentación Municipal</h2>
          <p className="page-subtitle-clean">
            Consulta decretos, acuerdos y plazos legales vigentes para los trámites y servicios públicos.
          </p>
        </div>
      </div>

      {/* Buscador Simple */}
      <form onSubmit={handleSearchSubmit} className="normativas-search-form">
        <div className="search-bar-clean" style={{ flex: 1 }}>
          <Search size={18} className="search-icon-clean" />
          <input
            type="text"
            className="search-input-clean"
            placeholder="Pregunta o busca por tema (ej: plazos de respuesta, fugas de agua, luminarias)..."
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
          />
          <button type="submit" className="btn-search-normativas-clean">
            <Sparkles size={14} />
            <span>Buscar</span>
          </button>
        </div>

        <div className="category-select-wrapper">
          <Filter size={16} color="#64748b" />
          <select
            className="select-clean-inline"
            value={selectedCategoria}
            onChange={(e) => setSelectedCategoria(e.target.value)}
          >
            <option value="Todas">Todas las Categorías</option>
            <option value="Derecho de Petición">Derecho de Petición</option>
            <option value="Agua y Alcantarillado">Agua y Alcantarillado</option>
            <option value="Recolección de Basura">Recolección de Basura</option>
            <option value="Alumbrado Público">Alumbrado Público</option>
          </select>
        </div>
      </form>

      {/* Sugerencias Rápidas */}
      <div className="quick-topics-row">
        <span className="quick-topics-label">Temas frecuentes:</span>
        <button type="button" className="quick-topic-chip" onClick={() => handlePromptClick('términos legales de respuesta')}>
          Plazos legales de petición
        </button>
        <button type="button" className="quick-topic-chip" onClick={() => handlePromptClick('fuga de agua atención urgente')}>
          Atención urgente de fugas
        </button>
        <button type="button" className="quick-topic-chip" onClick={() => handlePromptClick('mantenimiento de luminarias')}>
          Reparación de luminarias
        </button>
        <button type="button" className="quick-topic-chip" onClick={() => handlePromptClick('recolección y rutas de basura')}>
          Rutas de recolección
        </button>
      </div>

      {/* Resultados o Spinner */}
      {loading ? (
        <div className="empty-state-clean">
          <Loader2 size={32} className="spinner-icon" color="var(--azul-institucional)" />
          <h4>Buscando normativas...</h4>
        </div>
      ) : normativasList.length === 0 ? (
        <div className="empty-state-clean">
          <Search size={32} color="#94a3b8" />
          <h4>No se encontraron normativas</h4>
          <p>Prueba con otros términos de búsqueda o selecciona otra categoría.</p>
        </div>
      ) : (
        <div className="normativas-results-grid">
          {normativasList.map((item) => (
            <article 
              key={item.id} 
              className="normativa-card-clean"
              onClick={() => setSelectedNormativa(item)}
            >
            <div className="normativa-card-top">
              <span className="normativa-cat-badge">{item.categoria}</span>
              <span className="normativa-ref-text">{item.articulo_referencia}</span>
            </div>

            <h3 className="normativa-card-title">{item.titulo}</h3>
            <p className="normativa-card-desc">{item.resumen_ejecutivo}</p>

            <div className="normativa-card-bottom">
              <span className="normativa-entity">{item.entidad_emisora}</span>
              <span className="normativa-read-more">
                <span>Ver contenido</span>
                <ChevronRight size={14} />
              </span>
            </div>
          </article>
        ))}
      </div>
      )}

      {/* Modal de Detalle de la Norma */}
      {selectedNormativa && (
        <div className="modal-overlay" onClick={() => setSelectedNormativa(null)}>
          <div className="modal-card-clean" onClick={(e) => e.stopPropagation()}>
            <div className="modal-clean-header">
              <div>
                <span className="normativa-cat-badge">{selectedNormativa.categoria}</span>
                <h3 className="modal-clean-title">{selectedNormativa.titulo}</h3>
                <span className="normativa-ref-text">{selectedNormativa.articulo_referencia}</span>
              </div>
              <button 
                type="button" 
                className="btn-modal-close" 
                onClick={() => setSelectedNormativa(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-clean-body">
              <div className="normativa-content-box">
                <h4>Texto Oficial y Marco Jurídico</h4>
                <p>{selectedNormativa.contenido}</p>
              </div>

              <div className="normativa-resumen-box">
                <strong>Resumen Aplicable:</strong>
                <p>{selectedNormativa.resumen_ejecutivo}</p>
              </div>
            </div>

            <div className="modal-clean-footer">
              <span className="normativa-entity">Emisor: {selectedNormativa.entidad_emisora}</span>
              <button 
                type="button" 
                className="btn-action-primary-clean"
                onClick={() => setSelectedNormativa(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default NormativasPage;
