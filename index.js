import fetch from 'node-fetch';
import fs from 'fs';
import { getBarChart } from './util.js';

const COUNTRIES = ["DEU", "FRA", "GBR", "ITA", "NLD", "ESP", "FIN", "AUT", "BEL", "DNK", "EST", "GRC", "HUN", "POL", "IRL", "PRT", "ROU", "SWE", "NOR", "CHE"];

const src = "https://covid.ourworldindata.org/data/owid-covid-data.json";
const dst = "owid-covid-data.json";

// const stats = fs.statSync(dst);

function process(data)
{
    const countries = COUNTRIES;

    var maxLeft = 100, maxRight = 5000, scaleLeft = maxRight / maxLeft;

    const chartData = countries.map(country =>
    {
        const timeline = data[country].data.sort((a, b) => b.date.localeCompare(a.date));

        const valid = timeline.find(d => d.total_deaths_per_million > 0 && d.people_fully_vaccinated_per_hundred > 0 && d.total_boosters_per_hundred > 0);

        return { id: country, ...valid, location: data[country].location, };

    }).reduce((arr, valid) =>
    {
        if (valid.date)
        {
            arr.push({ id: valid.location, value: -valid.total_boosters_per_hundred * scaleLeft, type: 0, date: valid.date, });
            arr.push({ id: valid.location, value: valid.total_deaths_per_million, type: 1, date: valid.date, });
        }

        return arr;
    }, []);

    chartData.sort((a, b) => b.value - a.value);
    // chartData.sort((a, b) => a.value - b.value);

    const chart = getBarChart({ chartData, xDomain: [-maxLeft * scaleLeft, maxRight], xFormat: d => d < 0 ? parseInt(-d / scaleLeft) + "%" : d, xLabelLeft: "Percentage of population fully vaccinated", xLabel: "vs.", xLabelRight: "Total deaths per million", });
    fs.writeFileSync("test.svg", chart);

    fs.writeFileSync("test.html", "<html><body>" + chart + "</body></html>");
}

fs.readFile(dst, {}, (err, data) =>
{
    process(JSON.parse(data));
});

/*
fetch(src).then(res => res.json()).then(data =>
{
    fs.writeFileSync(dst, JSON.stringify(data, null, 2));
});
*/
