let colors = [
    "#37c200", // Asian
    "#00027e", // Black
    "#009d97", // Latino
    "#CC0701", // White
    "#d633ad"  // Other
];

let guideSelector = "#guide";

queue()
    .defer(d3.csv, "data/us_tile_grid.csv")
    .defer(d3.csv, "data/race_ethnicity_gender_2010.csv")
    .defer(d3.csv, "data/StatePrisonRateByYear.csv")
    .defer(d3.csv, "data/stateAbbrevs.csv")
    .await(loadData);

function loadData(error, usTileGrid, raceData, stateData, stateAbbrevs, stateJson) {
    usTileGrid = d3.nest()
        .key(d => d.state)
        .rollup(d => d[0])
        .object(usTileGrid);

    raceData.forEach(function(d) {
        for (let prop in d) {
            let tmp = +(d[prop].replace(/,/g, ''));
            if (!isNaN(tmp)) {
                d[prop] = tmp;
            }
        }
        if (d.GEOID !== "US") {
            d.row = +usTileGrid[d.GEOID].row;
            d.col = +usTileGrid[d.GEOID].col;
        }
    });

    let USData = raceData[0];
    raceData = raceData.slice(1, raceData.length);

    let eventHandler = {};
    let bubbleVis = new BubbleVis("#bubble-area", raceData);
}