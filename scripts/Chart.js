const fs = require('fs');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

async function createLineChart(data, filename, title, labelColumnName, displayColumnNames) {
  const chartCallback = (ChartJS) => {
    ChartJS.defaults.responsive = false;
    ChartJS.defaults.maintainAspectRatio = false;
  };  

  const colors = [
    '#FF0000',
    '#00FF00',
    '#0000FF',
    '#FFFF00',
    '#FF00FF',
    '#00FFFF',
    '#000000',
    '#FF0000',
    '#00FF00',
    '#0000FF',
    '#FFFF00',
    '#FF00FF',
    '#00FFFF',
    '#000000',
  ]


  const configuration = {
    type: 'line',
    data: {
      // labels: displayColumnNames,
      datasets: displayColumnNames.map((columnname, index) => ({
        label: columnname,
        data: data.map(row => ({x: row[labelColumnName], y: row[columnname]})),
        borderColor: colors[index],
        backgroundColor: colors[index],        
      })),
    },
    options: {},
    plugins: [{
        id: 'background-colour',
        beforeDraw: (chart) => {
            const ctx = chart.ctx;
            ctx.save();
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            ctx.restore();
        }        
    }]
  };
  
  const width = 800;
  const height = 600;
  const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height, chartCallback });
     
  const image = await chartJSNodeCanvas.renderToBuffer(configuration);

  fs.writeFileSync(filename, image, 'base64');
  console.log(`Chart saved as ${filename}`);
}

module.exports = { createLineChart };