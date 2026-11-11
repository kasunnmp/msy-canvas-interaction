import { memo } from 'react';
import {
  AreaChart,
  BoxplotChart,
  BubbleChart,
  BulletChart,
  CirclePackChart,
  DonutChart,
  GaugeChart,
  GroupedBarChart,
  HeatmapChart,
  HistogramChart,
  LineChart,
  LollipopChart,
  MeterChart,
  PieChart,
  RadarChart,
  ScatterChart,
  SimpleBarChart,
  StackedAreaChart,
  StackedBarChart,
  TreemapChart,
} from '@carbon/charts-react';
import '@carbon/charts-react/styles.css';
import type { TileType } from '../model/types';
import type { TileData } from '../model/data';

/* §9.1 Charts are built with Carbon Charts. This wrapper applies the §7 priority ladder. */

export interface Ladder {
  /** Tier 2: legend, axis labels. */
  tier2: boolean;
  /** Tier 3: gridlines / tick density (thinned before dropped). */
  tier3: boolean;
}

const BLUE = '#1734d6';
const PALETTE = ['#1734d6', '#5b8def', '#9fb9ff', '#00a6a6', '#f59f00', '#e8590c', '#ae3ec9', '#868e96'];

const scale = (groups: string[]) => Object.fromEntries(groups.map((g, i) => [g, PALETTE[i % PALETTE.length]]));

const base = (l: Ladder, extra: Record<string, unknown> = {}) => ({
  height: '100%',
  width: '100%',
  resizable: true,
  animations: false,
  theme: 'white',
  toolbar: { enabled: false },
  legend: { enabled: l.tier2, clickable: false, alignment: 'left' },
  tooltip: { enabled: true },
  grid: { x: { enabled: false }, y: { enabled: l.tier3 } },
  ...extra,
});

const cartesian = (l: Ladder, max: number, ticks = l.tier3 ? 6 : 3) => ({
  bottom: { mapsTo: 'key', scaleType: 'labels', visible: l.tier2, ticks: { number: ticks } },
  // Charts thin rather than crop (§7.1): fewer ticks when small, axis always from zero.
  right: { mapsTo: 'value', scaleType: 'linear', visible: l.tier2, ticks: { number: l.tier3 ? 8 : 3 }, domain: [0, Math.max(1, Math.ceil(max * 1.15))] },
});

function ChartImpl({ type, data, ladder }: { type: TileType; data: TileData; ladder: Ladder }) {
  const { labels, series, series2, categories, value } = data;
  const l = ladder;
  const single = labels.map((key, i) => ({ group: 'Value', key, value: series[i] ?? 0 }));
  const double = [
    ...labels.map((key, i) => ({ group: 'Current', key, value: series[i] ?? 0 })),
    ...labels.map((key, i) => ({ group: 'Previous', key, value: series2[i] ?? 0 })),
  ];
  const cats = categories.map((c) => ({ group: c.label, key: c.label, value: c.value }));
  const catGroups = categories.map((c) => c.label);
  const o = (extra: Record<string, unknown>) => base(l, extra) as never;
  const max1 = Math.max(...series, 1);
  const max2 = Math.max(...series.map((v, i) => v + (series2[i] ?? 0)), 1);

  switch (type) {
    case 'line':
      return <LineChart data={single} options={o({ axes: cartesian(l, max1), color: { scale: { Value: BLUE } }, points: { radius: 3 }, legend: { enabled: false } })} />;
    case 'area':
      return (
        <AreaChart
          data={single}
          options={o({
            axes: cartesian(l, max1),
            color: { scale: { Value: BLUE }, gradient: { enabled: true } },
            points: { radius: 3 },
            legend: { enabled: false },
          })}
        />
      );
    case 'stream':
      return <StackedAreaChart data={double} options={o({ axes: cartesian(l, max2), curve: 'curveBasis', color: { scale: scale(['Current', 'Previous']) } })} />;
    case 'stackedArea':
      return <StackedAreaChart data={double} options={o({ axes: cartesian(l, max2), color: { scale: scale(['Current', 'Previous']) } })} />;
    case 'simpleBar':
      return (
        <SimpleBarChart
          data={cats}
          options={o({ axes: { left: { mapsTo: 'value', visible: l.tier2 }, bottom: { mapsTo: 'key', scaleType: 'labels', visible: l.tier2 } }, color: { scale: scale(catGroups) }, legend: { enabled: false } })}
        />
      );
    case 'floatingBar':
      return (
        <SimpleBarChart
          data={categories.map((c, i) => ({ group: 'Range', key: c.label, value: [Math.round(c.value * 0.4), c.value + i * 3] }))}
          options={o({ axes: { left: { mapsTo: 'value', visible: l.tier2 }, bottom: { mapsTo: 'key', scaleType: 'labels', visible: l.tier2 } }, color: { scale: { Range: BLUE } }, legend: { enabled: false } })}
        />
      );
    case 'groupedBar':
      return <GroupedBarChart data={double} options={o({ axes: { left: { mapsTo: 'value', visible: l.tier2 }, bottom: { mapsTo: 'key', scaleType: 'labels', visible: l.tier2 } }, color: { scale: scale(['Current', 'Previous']) } })} />;
    case 'stackedBar':
      return <StackedBarChart data={double} options={o({ axes: { left: { mapsTo: 'value', stacked: true, visible: l.tier2 }, bottom: { mapsTo: 'key', scaleType: 'labels', visible: l.tier2 } }, color: { scale: scale(['Current', 'Previous']) } })} />;
    case 'lollipop':
      return <LollipopChart data={cats} options={o({ axes: { left: { mapsTo: 'value', visible: l.tier2 }, bottom: { mapsTo: 'key', scaleType: 'labels', visible: l.tier2 } }, color: { scale: scale(catGroups) }, legend: { enabled: false } })} />;
    case 'bubble':
      return (
        <BubbleChart
          data={categories.map((c, i) => ({ group: c.label, x: series[i % series.length] ?? i, y: c.value, size: series2[i % series2.length] ?? 4 }))}
          options={o({ axes: { bottom: { mapsTo: 'x', visible: l.tier2 }, left: { mapsTo: 'y', visible: l.tier2 } }, bubble: { radiusMapsTo: 'size' }, color: { scale: scale(catGroups) } })}
        />
      );
    case 'radar':
      return (
        <RadarChart
          data={[
            ...categories.slice(0, 6).map((c) => ({ product: 'Current', feature: c.label, score: c.value })),
            ...categories.slice(0, 6).map((c, i) => ({ product: 'Previous', feature: c.label, score: Math.round(c.value * (0.6 + (i % 3) * 0.15)) })),
          ]}
          options={o({ radar: { axes: { angle: 'feature', value: 'score' } }, data: { groupMapsTo: 'product' }, color: { scale: scale(['Current', 'Previous']) } })}
        />
      );
    case 'donut':
      return <DonutChart data={cats} options={o({ donut: { center: { label: 'Total' }, alignment: 'center' }, color: { scale: scale(catGroups) }, pie: { labels: { enabled: false } } })} />;
    case 'pie':
      return <PieChart data={cats} options={o({ color: { scale: scale(catGroups) }, pie: { labels: { enabled: l.tier3 }, alignment: 'center' } })} />;
    case 'gauge':
      return (
        <GaugeChart
          data={[
            { group: 'value', value: Math.min(100, value) },
            { group: 'delta', value: data.delta },
          ]}
          options={o({ gauge: { type: 'semi', status: value >= 70 ? 'success' : 'warning', deltaArrow: { enabled: l.tier2 } }, legend: { enabled: false } })}
        />
      );
    case 'meter':
      return (
        <MeterChart
          data={[{ group: 'Used', value: Math.min(100, Math.round((value % 100) + 1)) }]}
          options={o({ meter: { peak: 90, status: { ranges: [{ range: [0, 60], status: 'success' }, { range: [60, 85], status: 'warning' }, { range: [85, 100], status: 'danger' }] } }, legend: { enabled: false } })}
        />
      );
    case 'bullet':
      return (
        <BulletChart
          data={[{ title: 'Value', group: 'Value', ranges: [value * 0.5, value * 0.8, value * 1.2], marker: Math.round(value * 0.9), value }]}
          options={o({ axes: { bottom: { mapsTo: 'value', visible: l.tier2 }, left: { scaleType: 'labels', mapsTo: 'title', visible: l.tier2 } }, legend: { enabled: false } })}
        />
      );
    case 'boxplot':
      return (
        <BoxplotChart
          data={categories.slice(0, 5).flatMap((c, i) => series.map((v, j) => ({ group: c.label, key: c.label, value: Math.round(v * (0.6 + ((i + j) % 5) * 0.2)) })))}
          options={o({ axes: { left: { mapsTo: 'value', visible: l.tier2 }, bottom: { mapsTo: 'group', scaleType: 'labels', visible: l.tier2 } }, color: { scale: scale(catGroups) }, legend: { enabled: false } })}
        />
      );
    case 'histogram':
      return (
        <HistogramChart
          data={[...series, ...series2, ...series.map((v) => v * 1.3)].map((v) => ({ group: 'Values', value: v }))}
          options={o({ axes: { bottom: { mapsTo: 'value', bins: l.tier3 ? 10 : 5, limitDomainToBins: true, visible: l.tier2 }, left: { mapsTo: 'value', binned: true, visible: l.tier2 } }, color: { scale: { Values: BLUE } }, legend: { enabled: false } })}
        />
      );
    case 'scatter':
      return (
        <ScatterChart
          data={[...series, ...series2].map((v, i) => ({ group: i < series.length ? 'Current' : 'Previous', key: (i % labels.length) + 1, value: v }))}
          options={o({ axes: { bottom: { mapsTo: 'key', visible: l.tier2 }, left: { mapsTo: 'value', visible: l.tier2 } }, color: { scale: scale(['Current', 'Previous']) } })}
        />
      );
    case 'heatmap': {
      const rows = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const cols = ['00', '03', '06', '09', '12', '15', '18', '21'];
      return (
        <HeatmapChart
          data={rows.flatMap((r, i) => cols.map((c, j) => ({ day: r, hour: c, value: Math.round(((series[(i + j) % series.length] ?? 5) * (1 + Math.sin(i + j))) % 60) })))}
          options={o({
            axes: { bottom: { mapsTo: 'hour', scaleType: 'labels', visible: l.tier2 }, left: { mapsTo: 'day', scaleType: 'labels', visible: l.tier2 } },
            heatmap: { colorLegend: { title: '' } },
            color: { gradient: { colors: ['#eef2ff', '#9fb9ff', '#1734d6'] } },
            legend: { enabled: false },
          })}
        />
      );
    }
    case 'treemap':
      return (
        <TreemapChart
          data={[{ name: 'Departments', children: categories.map((c) => ({ name: c.label, value: c.value })) }]}
          options={o({ color: { scale: { Departments: BLUE } }, legend: { enabled: false } })}
        />
      );
    case 'circlePack':
      return (
        <CirclePackChart
          data={[{ name: 'Departments', children: categories.map((c) => ({ name: c.label, value: c.value })) }]}
          options={o({ color: { scale: { Departments: BLUE } }, legend: { enabled: false }, circlePack: { hierarchyLevel: 2 } })}
        />
      );
    default:
      return null;
  }
}

export const Chart = memo(ChartImpl);

/** Tile types rendered by Carbon (the rest are composed by hand). */
export const CARBON_TYPES = new Set<TileType>([
  'line',
  'area',
  'stream',
  'stackedArea',
  'simpleBar',
  'floatingBar',
  'groupedBar',
  'stackedBar',
  'lollipop',
  'bubble',
  'radar',
  'donut',
  'pie',
  'gauge',
  'meter',
  'bullet',
  'boxplot',
  'histogram',
  'scatter',
  'heatmap',
  'treemap',
  'circlePack',
]);
