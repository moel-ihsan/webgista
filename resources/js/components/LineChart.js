import { Line } from "vue-chartjs";
// Chart.defaults.global.defaultFontColor = 'white';
Chart.defaults.global.defaultFontFamily = 'Montserrat';
Chart.defaults.global.lineHeight = '1.2';
Chart.defaults.global.legend = false;

export default {
  extends: Line,
  data() {
    return {
      gradient: null,
      // gradient2: null
    };
  },
  mounted() {
    this.gradient = this.$refs.canvas
      .getContext("2d")
      .createLinearGradient(0, 230, 0, 50);
    // this.gradient2 = this.$refs.canvas
    //   .getContext("2d")
    //   .createLinearGradient(0, 0, 0, 450);

    this.gradient.addColorStop(1, "rgba(66, 183, 130, 0.20)");
    this.gradient.addColorStop(0.4, "rgba(66, 183, 130, 0.0)");
    this.gradient.addColorStop(0, "rgba(66, 183, 130, 0)");

    // this.gradient2.addColorStop(0, "rgba(0, 231, 255, 0.9)");
    // this.gradient2.addColorStop(0.5, "rgba(0, 231, 255, 0.25)");
    // this.gradient2.addColorStop(1, "rgba(0, 231, 255, 0)");

    this.renderChart(
      {
        labels: [
          "JAN",
          "FEB",
          "MAR",
          "APR",
          "MAY",
          "JUN",
          "JUL",
          "AUG",
          "SEP",
          "OCT",
          "NOV",
          "DEC",
        ],
        datasets: [
          {
            label: "Car",
            borderColor: "rgba(58, 155, 108, 1)",
            borderWidth: 1,
            borderDash: [],
            borderDashOffset: 0.0,
            pointBackgroundColor: "white",
            pointBorderColor: "rgba(58, 155, 108, 1)",
            backgroundColor: this.gradient,                                 
            pointHoverRadius: 4,
            pointHoverBorderWidth: 10,
            pointRadius: 4,     
            data: [40, 39, 100, 40, 39, 80, 40, 100, 90, 50, 30, 58]
          },                                       
        ]
      },      
      { responsive: true, maintainAspectRatio: false,scales: {        
        yAxes: [{
          stacked:true,
          gridLines:{
            display:false
          },
          ticks: {
            min: 0,
            max: 100,
            stepSize: 20,
          }
        }]
      } }
    );
  }
};
