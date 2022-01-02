import * as d3 from 'd3';
import jsdom from 'jsdom';
import StackedBarChart from './StackedBarChart.js';

const { JSDOM } = jsdom;

function getBarChart({ chartData, xDomain, xFormat, xLabel, xLabelLeft, xLabelRight, })
{
    const id = "chart";
    const width = 1024, height = 1024;

    const document = new JSDOM().window.document;

    const body = d3.select(document.body)
        .append('div')
        .attr('id', id);

    const svg = body.append('svg')
        .attr('class', 'svg-chart')
        .attr('width', width)
        .attr('height', height);
    //        .append('g');
    //        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    //     .call(chart.render.bind(chart));


    const config =
    {
        svg,
        x: d => d.value,
        y: d => d.id,
        z: d => d.type,
        title: d => "X" + d.location,
        xDomain,
        width,
        xFormat,
        xLabel,
        xLabelLeft,
        xLabelRight,
    }

    new StackedBarChart(chartData, config,);

    console.log("CHART", chartData, config,);

    const html = d3.select(document.getElementById(id)).node().innerHTML;
    d3.select(document.getElementById(id)).remove();

    return html;
    /*
    const document = new JSDOM().window.document;
    global.document = document;

    const body = d3.select(document.body).select("body");

    const width = 1024, height = 768;

    const svg = body.append("svg").attr("width", width).attr("height", height);

    svg.append("line")
        .attr("x1", 100)
        .attr("y1", 100)
        .attr("x2", 200)
        .attr("y2", 200)
        .style("stroke", "rgb(255,0,0)")
        .style("stroke-width", 2);

    const result = body.node().innerHTML;

    return result;
    */
}

export { getBarChart, };
