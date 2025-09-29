import { useEffect, useState, useRef } from 'react';
import mermaid from 'mermaid';
import { ZoomIn, ZoomOut, RotateCcw, Maximize2 } from 'lucide-react';

const MermaidTest = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;

    const initializeMermaid = async () => {
      try {
        // Initialize mermaid once
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          securityLevel: 'loose',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          themeVariables: {
            background: '#1f2937',
            primaryColor: '#3b82f6',
            primaryTextColor: '#ffffff',
            primaryBorderColor: '#6b7280',
            lineColor: '#6b7280',
            sectionBkgColor: '#374151',
            altSectionBkgColor: '#4b5563',
            gridColor: '#6b7280',
            secondaryColor: '#6366f1',
            tertiaryColor: '#8b5cf6',
          }
        });

        // Wait for next tick
        await new Promise(resolve => setTimeout(resolve, 50));

        if (mounted) {
          // Create a unique ID for this diagram
          const diagramId = `mermaid-diagram-${Date.now()}`;

          // Render the diagram to string
          const { svg } = await mermaid.render(diagramId, mermaidDiagram);

          if (mounted) {
            setSvgContent(svg);
            setIsLoading(false);
          }
        }
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        if (mounted) {
          setError(`Failed to render diagram: ${err instanceof Error ? err.message : 'Unknown error'}`);
          setIsLoading(false);
        }
      }
    };

    initializeMermaid();

    return () => {
      mounted = false;
    };
  }, []);

  // Zoom and pan functions
  const handleZoomIn = () => {
    setZoom(prevZoom => Math.min(prevZoom * 1.2, 3));
  };

  const handleZoomOut = () => {
    setZoom(prevZoom => Math.max(prevZoom / 1.2, 0.3));
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleFitToScreen = () => {
    if (containerRef.current) {
      const container = containerRef.current;
      const svg = container.querySelector('svg');
      if (svg) {
        const containerRect = container.getBoundingClientRect();
        const svgRect = svg.getBoundingClientRect();
        const scaleX = (containerRect.width - 40) / svgRect.width;
        const scaleY = (containerRect.height - 40) / svgRect.height;
        const optimalZoom = Math.min(scaleX, scaleY, 1);
        setZoom(optimalZoom);
        setPan({ x: 0, y: 0 });
      }
    }
  };

  // Mouse event handlers for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prevZoom => Math.min(Math.max(prevZoom * delta, 0.3), 3));
  };

  const mermaidDiagram = `
    erDiagram
      CONTACTS {
        INTEGER id PK
        TEXT webhook_id
        TEXT phone
        TEXT first_name
        TEXT last_name
        TEXT email
        TEXT address
        TEXT city
        TEXT state
        TEXT zip_code
        DATETIME created_at
        DATETIME updated_at
      }

      LEADS {
        INTEGER id PK
        INTEGER contact_id FK
        TEXT webhook_id
        TEXT lead_type
        TEXT first_name
        TEXT last_name
        TEXT email
        TEXT phone
        TEXT address
        TEXT city
        TEXT state
        TEXT zip_code
        TEXT source
        TEXT status
        DATETIME created_at
        DATETIME updated_at
      }

      APPOINTMENTS {
        INTEGER id PK
        INTEGER lead_id FK
        INTEGER contact_id FK
        TEXT appointment_type
        DATETIME scheduled_at
        TEXT status
        TEXT location_type
        TEXT notes
        DATETIME created_at
        DATETIME updated_at
      }

      CONVERSIONS {
        TEXT id PK
        INTEGER contact_id FK
        INTEGER lead_id FK
        TEXT workspace_id
        TEXT converted_by
        DATETIME converted_at
        TEXT conversion_type
        REAL conversion_value
        DATETIME created_at
      }

      CONTACTS ||--o{ LEADS : "has"
      CONTACTS ||--o{ APPOINTMENTS : "schedules"
      CONTACTS ||--o{ CONVERSIONS : "converts_to"
      LEADS ||--o{ APPOINTMENTS : "generates"
      LEADS ||--o{ CONVERSIONS : "results_in"
  `;

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-4">Mermaid Diagram Test</h1>
        <p className="text-gray-400">Testing mermaid diagram rendering with database schema</p>
      </div>

      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Database Schema ERD</h2>

          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleZoomOut}
              className="p-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-400 min-w-[60px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleFitToScreen}
              className="p-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
              title="Fit to Screen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetView}
              className="p-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
              title="Reset View"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          ref={containerRef}
          className="mermaid-container border border-gray-700 rounded-lg overflow-hidden"
          style={{
            minHeight: '500px',
            cursor: isDragging ? 'grabbing' : 'grab',
            position: 'relative'
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          {isLoading && (
            <div className="flex items-center justify-center h-full">
              <div className="flex items-center gap-2 text-gray-400">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                <span>Rendering diagram...</span>
              </div>
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-red-400 text-center">
                <p className="mb-2">❌ {error}</p>
                <p className="text-sm text-gray-500">Check console for detailed error information</p>
              </div>
            </div>
          )}
          {svgContent && !isLoading && !error && (
            <div
              className="mermaid-svg w-full h-full flex justify-center items-center"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.1s ease-out'
              }}
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          )}
        </div>

        <div className="mt-2 text-xs text-gray-500 text-center">
          💡 Use mouse wheel to zoom, click and drag to pan
        </div>
      </div>

      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
        <h2 className="text-xl font-semibold text-white mb-4">Raw Mermaid Code</h2>
        <pre className="bg-gray-800 text-gray-300 p-4 rounded-lg overflow-x-auto text-sm">
          <code>{mermaidDiagram}</code>
        </pre>
      </div>
    </div>
  );
};

export default MermaidTest;