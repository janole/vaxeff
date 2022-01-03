import fetch from 'node-fetch';
import zlib from 'zlib';
import fs from 'fs';
import puppeteer from 'puppeteer';
import { getBarChart } from './util.js';

const COUNTRIES = ["DEU", "FRA", "GBR", "ITA", "NLD", "ESP", "FIN", "AUT", "BEL", "DNK", "EST", "GRC", "HUN", "POL", "IRL", "PRT", "ROU", "SWE", "NOR", "CHE", "BGR", "HRV", "CZE", "LUX", "LVA", "LTU", "SVK", "SVN",];

const src = "https://covid.ourworldindata.org/data/owid-covid-data.json";
const dst = "owid-covid-data.json.gz";

function getChart({ data, left, right, sort, reverse, labelLeft, labelRight, maxDate = "9999-99-99", })
{
    const countries = COUNTRIES;

    var maxLeft = 100, maxRight = 1, scaleLeft = maxRight / maxLeft;

    const chartData = countries.map(country =>
    {
        const timeline = data[country].data
            .filter(d => d.date < maxDate)
            .sort((a, b) => b.date.localeCompare(a.date));

        const valid = timeline.find(d => left(d) > 0 && right(d) > 0);

        const r = right(valid);

        if (r > maxRight)
        {
            const high10 = Math.pow(10, parseInt(Math.log10(r)));
            maxRight = (parseInt(r / high10) + 1) * high10;
            scaleLeft = maxRight / maxLeft;
        }

        return { id: country, ...valid, location: data[country].location, };

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
        chartData.sort(((a, b) => right(b) - right(a)));
    else
        chartData.sort(((a, b) => left(b) - left(a)));

    if (reverse)
        chartData.reverse();

    const chart = getBarChart({ chartData, xDomain: [-maxLeft * scaleLeft, maxRight], xFormat: d => d < 0 ? parseInt(-d / scaleLeft) + "%" : d, xLabelLeft: labelLeft, xLabel: "vs.", xLabelRight: labelRight, });

    return chart;
}

function process(data)
{
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
        right: d => d?.new_deaths_smoothed_per_million,
        labelLeft: "Percentage of population fully vaccinated",
        labelRight: "New deaths per million"
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
        charts.push(getChart({ data, ...stat, reverse: true, }));
        charts.push(getChart({ data, ...stat, sort: "right", }));
    });

    const html = '<html><head>'
        + '<meta name="viewport" content="width=device-width, initial-scale=1" />'
        + '<meta name="twitter:card" content="COVID-19 Stats" />'
        + '<meta name="twitter:creator" content="@janole" />'
        + '<meta name="twitter:image" content="https://janole.github.io/vaxeff/screenshot.png" />'
        + '</head><body>'
        + charts.join('<br />')
        + '</body></html>';

    fs.mkdirSync("docs", { recursive: true });
    fs.writeFileSync("docs/index.html", html);

    (async () =>
    {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.setViewport({ width: 1024, height: 768, deviceScaleFactor: 2, });
        await page.setContent(html);
        await page.screenshot({ path: 'screenshot.png' });

        await browser.close();
    })();
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
