import fetch from 'node-fetch';
import zlib from 'zlib';
import fs from 'fs';

import { getBarChart, svg2png, } from './util.js';

const COUNTRIES = [
    'ISL', 'NOR', 'SWE', 'FIN', 'DNK',
    'DEU', 'CHE', 'POL', 'AUT', 'HUN',
    'IRL', 'GBR', 'FRA', 'NLD', 'BEL',
    'PRT', 'ESP', 'ITA', 'NLD', 'DEU',
];

const src = "https://covid.ourworldindata.org/data/owid-covid-data.json";
const dst = "owid-covid-data.json.gz";

function getChart({ owid, left, right, sort, reverse, labelLeft, labelRight, maxDate = "9999-99-99", width = 1024, height = 768, })
{
    const countries = COUNTRIES;

    var maxLeft = 100, maxRight = 1, scaleLeft = maxRight / maxLeft;

    // TODO: simplify the right()/left() calls where we're merging data[i] + info all the time
    const chartData = countries.map(country =>
    {
        const { data, ...info } = owid[country];

        // filter and sort values from most recent to oldest
        const timeline = data
            .filter(d => d.date < maxDate)
            .sort((a, b) => b.date.localeCompare(a.date));

        // find newest value that contains both left and right values
        const valid = timeline.find(d => left(d) > 0 && right(d) > 0);

        // find the biggest value on the right hand side of the chart (and add country data)
        const r = right(valid);

        if (r > maxRight)
        {
            // clamp the max value to power-of-ten bands (5600 would yield 6000) TODO: is there a better algorithm?
            const high10 = Math.pow(10, parseInt(Math.log10(r)));
            maxRight = (parseInt(r / high10) + 1) * high10;

            // recalculate the scale of the left hand side
            scaleLeft = maxRight / maxLeft;
        }

        return { ...info, ...valid, id: country, };

    }).reduce((arr, valid) =>
    {
        if (valid.date)
        {
            arr.push({ ...valid, id: valid.location, value: -left(valid) * scaleLeft, title: left(valid) + "% @ " + valid.date, type: 0, date: valid.date, });
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

    const chart = getBarChart({
        chartData,
        xDomain: [-maxLeft * scaleLeft, maxRight],
        xFormat: d => d < 0 ? parseInt(-d / scaleLeft) + "%" : d,
        xLabelLeft: labelLeft,
        xLabel: "vs.",
        xLabelRight: labelRight,
        width,
        height,
    });

    return chart;
}

function process(owid)
{
    const dimension = { width: 1024, height: 25 * COUNTRIES.length, }
    const stats = [];

    stats.push({
        left: d => d?.people_fully_vaccinated_per_hundred,
        right: d => d?.total_deaths_per_million,
        labelLeft: "Percentage of population fully vaccinated",
        labelRight: "Total deaths per million"
    });

    stats.push({
        left: d => d?.people_fully_vaccinated_per_hundred,
        right: d => d?.excess_mortality_cumulative_per_million,
        labelLeft: "Percentage of population fully vaccinated",
        labelRight: "Excess mortality per million"
    });

    stats.push({
        left: d => d?.people_fully_vaccinated_per_hundred,
        right: d => d?.total_cases_per_million,
        labelLeft: "Percentage of population fully vaccinated",
        labelRight: "Total cases per million"
    });

    stats.push({
        left: d => d?.people_fully_vaccinated_per_hundred,
        right: d => d?.new_cases_smoothed_per_million,
        labelLeft: "Percentage of population fully vaccinated",
        labelRight: "New cases per million"
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
        + '<meta name="twitter:image" content="https://janole.github.io/vaxeff/screenshot.png" />'
        + '<meta property="og:image" content="https://janole.github.io/vaxeff/screenshot.png" />'
        + '</head><body>'
        + charts.join('<br />')
        + '</body></html>';

    fs.mkdirSync("docs", { recursive: true });
    fs.writeFileSync("docs/index.html", html);

    svg2png({ svg: html, ...dimension, path: 'docs/screenshot.png', });
}

const mtime = (fs.existsSync(dst) && fs.statSync(dst)?.mtime) ?? 0;

if (mtime < Date.now() - 1000 * 60 * 60 * 2)
{
    fetch(src).then(res => res.json()).then(data =>
    {
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
