import fetch from 'node-fetch';
import zlib from 'zlib';
import fs from 'fs';
import * as d3 from 'd3';

import { getBarChart, svg2png, } from './util.js';

const COUNTRIES = [
    'GRC', 'NOR', 'SWE', 'FIN', 'DNK',
    'DEU', 'CHE', 'POL', 'AUT', 'HUN',
    'IRL', 'GBR', 'FRA', 'NLD', 'BEL',
    'PRT', 'ESP', 'ITA', 'DEU',
];

const src = "https://covid.ourworldindata.org/data/owid-covid-data.json";
const dst = "owid-covid-data.json.gz";

function getChart({
    owid,
    left,
    right,
    sort,
    reverse,
    labelLeft,
    labelRight,
    maxDate = "9999-99-99",
    width = 1024,
    height = 768,
    maxLeft = 100,
    maxRight = 1,
    formatLeft = value => parseInt(value) + "%",
    formatRight = value => value,
    processDataPoint = (value, _country, _info) => value,
} = {})
{
    const countries = COUNTRIES;

    // TODO: simplify the right()/left() calls where we're merging data[i] + info all the time
    const chartData = countries.map(country =>
    {
        const { data, ...info } = owid[country];

        // filter and sort values from most recent to oldest
        const timeline = data
            .filter(d => d.date < maxDate)
            .sort((a, b) => b.date.localeCompare(a.date));

        // find newest value for right hand side
        const validRight = timeline.find(d => right(d) > 0);
        // find newest value for left hand side (not newer than right hand side, though)
        const validLeft = timeline.find(d => d.date <= validRight.date && left(d) > 0);

        // combine left and right values, keep date from right hand side and postprocess
        const valid = processDataPoint({ ...validLeft, ...validRight }, country, info);

        // find the biggest value on the right hand side of the chart
        const r = right(valid);

        if (r > maxRight)
        {
            // clamp the max value to power-of-ten bands (5600 would yield 6000) TODO: is there a better algorithm?
            const high10 = Math.pow(10, parseInt(Math.log10(r)));
            maxRight = (parseInt(r / high10) + 1) * high10;
        }

        return { ...info, ...valid, id: country, };

    }).reduce((arr, valid) =>
    {
        if (valid.date)
        {
            arr.push({ ...valid, id: valid.location, value: -left(valid) * maxRight / maxLeft, title: left(valid) + "% @ " + valid.date, type: 0, date: valid.date, });
            arr.push({ ...valid, id: valid.location, value: right(valid), type: 1, date: valid.date, });
        }

        return arr;

    }, []);

    if (sort == "right")
    {
        chartData.sort(((a, b) => right(b) - right(a)));
    }
    else
    {
        chartData.sort(((a, b) => left(b) - left(a)));
    }

    if (reverse)
    {
        chartData.reverse();
    }
    else
    {
        // swap first two elements to switch colors (wowsers!)
        [chartData[0], chartData[1]] = [chartData[1], chartData[0]];
    }

    const chart = getBarChart({
        chartData,
        xDomain: [-maxRight, maxRight],
        xFormat: d => d < 0 ? formatLeft(-d * maxLeft / maxRight) : formatRight(d),
        xLabelLeft: labelLeft,
        xLabel: "vs.",
        xLabelRight: labelRight,
        xLabelBottomRight: "Updated @ " + d3.timeFormat("%H:%M %d %b %Y")(new Date()) + " — Source: ourworldindata.org, github.com/janole/vaxeff",
        width,
        height,
    });

    return chart;
}

async function process(owid)
{
    const dimension = { width: 1024, height: 30 * COUNTRIES.length, }
    const stats = [];

    const labelLeft = "Percentage of population fully vaccinated";

    stats.push({
        left: d => d?.people_fully_vaccinated_per_hundred,
        right: d => d?.total_deaths_per_million,
        labelLeft,
        labelRight: "Total deaths related to COVID-19 (per million)"
    });

    stats.push({
        left: d => d?.people_fully_vaccinated_per_hundred,
        right: d => d?.excess_mortality_cumulative_per_million,
        labelLeft,
        labelRight: "Excess mortality since January 2020 (per million)"
    });

    stats.push({
        left: d => d?.people_fully_vaccinated_per_hundred,
        right: d => d?.total_cases_per_million,
        labelLeft,
        labelRight: "Total COVID-19 cases (per million)"
    });

    stats.push({
        left: d => d?.people_fully_vaccinated_per_hundred,
        right: d => d?.new_cases_per_million,
        labelLeft,
        labelRight: "New COVID-19 cases (per million)"
    });

    stats.push({
        left: d => d?.people_fully_vaccinated_per_hundred,
        right: d => d?.new_cases_smoothed_per_million / 10 * 7,
        labelLeft,
        labelRight: "New COVID-19 cases, 7-day smoothed (per 100.000)"
    });

    stats.push({
        formatLeft: d => d,
        left: d => (d?.stringency_index * 5 / 10 + d?.people_fully_vaccinated_per_hundred * 5 / 10),
        labelLeft: "Vaccrate + Stringency Index",
        right: d => d?.total_deaths_per_million,
        labelRight: "Total deaths related to COVID-19 (per million)"
    });

    const charts = [];

    stats.forEach(stat =>
    {
        charts.push(getChart({ ...dimension, owid, ...stat, reverse: true, }));
        charts.push(getChart({ ...dimension, owid, ...stat, sort: "right", }));
    });

    const html = '<html><head>'
        + '<meta name="viewport" content="width=device-width, initial-scale=1" />'
        + '<meta name="twitter:card" content="summary_large_image" />'
        + '<meta name="twitter:title" content="COVID-19 Stats" />'
        + '<meta name="twitter:site" content="@janole" />'
        + '<meta name="twitter:image" content="https://janole.github.io/vaxeff/screenshot00.png" />'
        + '<meta property="og:image" content="https://janole.github.io/vaxeff/screenshot00.png" />'
        + '</head><body>'
        + charts.join('<br />')
        + '</body></html>';

    fs.mkdirSync("docs", { recursive: true });
    fs.writeFileSync("docs/index.html", html);

    for (let i = charts.length - 1; i >= 0; i--)
    {
        await svg2png({ svg: charts[i], ...dimension, path: 'docs/screenshot' + ("00" + i).slice(-2) + '.png', });
    };
}

const mtime = (fs.existsSync(dst) && fs.statSync(dst)?.mtime) ?? 0;

if (mtime < Date.now() - 1000 * 60 * 60 * 2)
{
    fetch(src).then(res => res.json()).then(data =>
    {
        if (typeof data !== "object") data = JSON.parse(data);

        zlib.gzip(JSON.stringify(data), (err, data) =>
        {
            if (!err)
            {
                fs.writeFileSync(dst, data);
            }
        });

        process(data);
    });
}
else
{
    fs.readFile(dst, {}, (err, data) =>
    {
        if (!err)
        {
            zlib.gunzip(data, (err, data) =>
            {
                if (!err)
                {
                    process(JSON.parse(data.toString('utf8')));
                }
            });
        }
    });
}
