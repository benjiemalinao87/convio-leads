import { useEffect, useState, useRef } from 'react';
import mermaid from 'mermaid';
import { ZoomIn, ZoomOut, RotateCcw, Maximize2 } from 'lucide-react';

interface MermaidDiagramProps {
  diagram: string;
  title?: string;
  className?: string;
}

const MermaidDiagram = ({ diagram, title = "Mermaid Diagram", className = "" }: MermaidDiagramProps) => {
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
          const diagramId = `mermaid-diagram-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          // Render the diagram to string
          const { svg } = await mermaid.render(diagramId, diagram);

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
  }, [diagram]);

  // Reset view when diagram changes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [diagram]);

  // Zoom and pan functions
  const handleZoomIn = () => {
    setZoom(prevZoom => Math.min(prevZoom * 1.1, 3));
  };

  const handleZoomOut = () => {
    setZoom(prevZoom => Math.max(prevZoom / 1.1, 0.3));
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
    const delta = e.deltaY > 0 ? 0.95 : 1.05;
    setZoom(prevZoom => Math.min(Math.max(prevZoom * delta, 0.3), 3));
  };

  return (
    <div className={`bg-gray-900 rounded-lg border border-gray-800 ${className}`}>
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <h3 className="text-lg font-semibold text-white">{title}</h3>

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

      <div className="p-4">
        <div
          ref={containerRef}
          className="border border-gray-700 rounded-lg overflow-hidden"
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
    </div>
  );
};

export default MermaidDiagram;