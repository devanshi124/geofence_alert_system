import { useEffect } from "react";
import { useMap } from "react-leaflet";

function MapResizeController() {
  const map = useMap();

  useEffect(() => {
    const invalidate = () => {
      map.invalidateSize({
        animate: false,
        pan: false,
      });
    };

    // Initial render/layout settlement.
    const initialTimer =
      window.setTimeout(invalidate, 150);

    // Observe actual map container resizing.
    const container = map.getContainer();

    const resizeObserver = new ResizeObserver(() => {
      invalidate();
    });

    resizeObserver.observe(container);

    // Browser resizing.
    window.addEventListener("resize", invalidate);

    return () => {
      window.clearTimeout(initialTimer);
      resizeObserver.disconnect();
      window.removeEventListener(
        "resize",
        invalidate,
      );
    };
  }, [map]);

  return null;
}

export default MapResizeController;