import { useMemo, useState } from "react";

const CHART_HEIGHT = 210;
const CHART_TOP_PADDING = 18;

/**
 * data: [{ label: "Mon", entries: number, exits: number }, ...]
 */
function WeeklyActivityChart({ data = [] }) {
  const [activeIndex, setActiveIndex] = useState(null);

  const maxTotal = useMemo(() => {
    const max = Math.max(
      1,
      ...data.map((day) => day.entries + day.exits),
    );

    // round up to a "nice" ceiling so bars don't touch the top
    const magnitude = Math.pow(
      10,
      Math.max(0, String(Math.floor(max)).length - 1),
    );

    return Math.ceil(max / magnitude) * magnitude;
  }, [data]);

  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="trend-chart">
      <div className="trend-chart-plot">
        <div className="trend-chart-gridlines">
          {gridLines.map((fraction) => (
            <div
              className="trend-chart-gridline"
              key={fraction}
              style={{
                bottom: `${fraction * 100}%`,
              }}
            >
              <span>
                {Math.round(maxTotal * fraction)}
              </span>
            </div>
          ))}
        </div>

        <div className="trend-chart-bars">
          {data.map((day, index) => {
            const entriesHeight =
              (day.entries / maxTotal) *
              (CHART_HEIGHT - CHART_TOP_PADDING);

            const exitsHeight =
              (day.exits / maxTotal) *
              (CHART_HEIGHT - CHART_TOP_PADDING);

            const isActive = activeIndex === index;

            return (
              <div
                className="trend-chart-col"
                key={day.label}
                onMouseEnter={() =>
                  setActiveIndex(index)
                }
                onMouseLeave={() =>
                  setActiveIndex(null)
                }
              >
                {isActive ? (
                  <div className="trend-chart-tooltip">
                    <strong>{day.label}</strong>

                    <span>
                      <i className="legend-dot moving" />
                      {day.entries} entries
                    </span>

                    <span>
                      <i className="legend-dot alert" />
                      {day.exits} exits
                    </span>
                  </div>
                ) : null}

                <div
                  className={
                    isActive
                      ? "trend-chart-bar active"
                      : "trend-chart-bar"
                  }
                  style={{
                    height: `${CHART_HEIGHT}px`,
                  }}
                >
                  <div
                    className="trend-bar-segment exits"
                    style={{
                      height: `${exitsHeight}px`,
                    }}
                  />

                  <div
                    className="trend-bar-segment entries"
                    style={{
                      height: `${entriesHeight}px`,
                    }}
                  />
                </div>

                <span className="trend-chart-label">
                  {day.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default WeeklyActivityChart;