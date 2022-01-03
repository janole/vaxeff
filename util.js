import * as d3 from 'd3';
import jsdom from 'jsdom';
import puppeteer from 'puppeteer';

import StackedBarChart from './StackedBarChart.js';

const { JSDOM } = jsdom;

function getBarChart({ chartData, xDomain, xFormat, xLabel, xLabelLeft, xLabelRight, xLabelBottomLeft, xLabelBottomRight, width = 1024, height = 1024, })
{
    const id = "chart";

    const document = new JSDOM().window.document;

    const body = d3.select(document.body)
        .append('div')
        .attr('id', id);

    const svg = body.append('svg')
        .attr('class', 'svg-chart')
        .attr('width', width)
        .attr('height', height);

    const config =
    {
        svg,
        x: d => d.value,
        y: d => d.id,
        z: d => d.type,
        title: d => d.title || d.value,
        xDomain,
        width,
        height,
        xFormat,
        xLabel,
        xLabelLeft,
        xLabelRight,
        xLabelBottomLeft,
        xLabelBottomRight,
    }

    new StackedBarChart(chartData, config,);

    const html = d3.select(document.getElementById(id)).node().innerHTML;
    d3.select(document.getElementById(id)).remove();

    return html;
}

async function svg2png({ svg, width, height, deviceScaleFactor = 2, path, })
{
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor, });
    await page.setContent(svg);
    await page.screenshot({ path });

    await browser.close();
}

export { getBarChart, svg2png, };
