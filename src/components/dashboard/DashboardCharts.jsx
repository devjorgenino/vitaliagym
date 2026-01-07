import React from 'react';

export function MetricCard({ title, value, icon, trend, color = "blue" }) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    green: 'bg-green-50 border-green-200 text-green-800',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    red: 'bg-red-50 border-red-200 text-red-800',
    purple: 'bg-purple-50 border-purple-200 text-purple-800'
  };

  return (
    <div className={`p-6 rounded-lg border ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-75">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {trend && (
            <p className="text-xs mt-1 opacity-75">{trend}</p>
          )}
        </div>
        <div className="text-2xl opacity-50">
          {icon}
        </div>
      </div>
    </div>
  );
}

export function SimpleChart({ data, label, color = "#3B82F6" }) {
  if (!data || data.length === 0) return null;

  const maxValue = Math.max(...data.map(d => d.value));
  const width = 100;
  const height = 40;

  return (
    <div className="w-full">
      <p className="text-sm font-medium mb-2">{label}</p>
      <div className="flex items-end space-x-1" style={{ height: `${height}px` }}>
        {data.map((item, index) => {
          const barHeight = maxValue > 0 ? (item.value / maxValue) * height : 0;
          const barWidth = width / data.length - 2;
          
          return (
            <div
              key={index}
              className="relative group"
              style={{
                width: `${barWidth}px`,
                height: `${height}px`
              }}
            >
              <div
                className="absolute bottom-0 w-full rounded-t"
                style={{
                  height: `${barHeight}px`,
                  backgroundColor: color
                }}
              />
              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {item.value}
              </div>
              {item.label && (
                <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 text-xs text-gray-500 whitespace-nowrap">
                  {item.label}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PieChart({ data }) {
  if (!data || data.length === 0) return null;

  const total = data.reduce((sum, item) => sum + item.value, 0);
  const size = 120;
  const center = size / 2;
  const radius = size / 3;

  let cumulativePercentage = 0;

  const createPath = (startAngle, endAngle) => {
    const x1 = center + radius * Math.cos(startAngle);
    const y1 = center + radius * Math.sin(startAngle);
    const x2 = center + radius * Math.cos(endAngle);
    const y2 = center + radius * Math.sin(endAngle);

    const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;

    return `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
  };

  return (
    <div className="flex items-center space-x-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {data.map((item, index) => {
          const percentage = (item.value / total) * 100;
          const startAngle = (cumulativePercentage / 100) * 2 * Math.PI - Math.PI / 2;
          const endAngle = startAngle + (percentage / 100) * 2 * Math.PI;
          
          cumulativePercentage += percentage;

          return (
            <path
              key={index}
              d={createPath(startAngle, endAngle)}
              fill={item.color}
              stroke="white"
              strokeWidth="2"
            />
          );
        })}
      </svg>
      <div className="space-y-2">
        {data.map((item, index) => (
          <div key={index} className="flex items-center space-x-2">
            <div 
              className="w-4 h-4 rounded"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-sm">{item.label}</span>
            <span className="text-sm font-medium">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}