/**
 * BubbleVis
 * @param _parentElement 	-- html element in which to draw bubble vis
 * @param _data
 */
BubbleVis = function(_parentElement, _data) {
    this.parentElement = _parentElement;
    this.data = _data;
    this.races = ["Asian", "Black", "Latino", "White", "Other"];
    this.wrangleData();
};

BubbleVis.prototype.wrangleData = function() {
    let vis = this;
    vis.highestRate = 0;
    vis.lowestRate = 1;
    vis.highestPop = 0;
    vis.highestPrison = 0;

    // compute [r]Rate ∀(r ∈ this.races), add to new state entry
    vis.data = vis.data.map(function(state) {
        let newEntry = {
            Name: state.Geography,
            geo_ID: state.GEOID,
            row: state.row,
            col: state.col,
            AsianPop: state.AsianTotal,
            AsianPrison: state.AsianTotalPrison,
            AsianRate: state.AsianTotalPrison / state.AsianTotal,
            BlackPop: state.BlackTotal,
            BlackPrison: state.BlackTotalPrison,
            BlackRate: state.BlackTotalPrison / state.BlackTotal,
            LatinoPop: state.LatinoTotal,
            LatinoPrison: state.LatinoTotalPrison,
            LatinoRate: state.LatinoTotalPrison / state.LatinoTotal,
            WhitePop: state.WhiteTotal,
            WhitePrison: state.WhiteTotalPrison,
            WhiteRate: state.WhiteTotalPrison / state.WhiteTotal,
            OtherPop: state.OtherTotal,
            OtherPrison: state.OtherTotalPrison,
            OtherRate: state.OtherTotalPrison / state.OtherTotal
        };

        // calculate absolute maxes/mins for use in scales/axes later
        let rates = vis.races.map(r => newEntry[r+'Rate']);
        let pops = vis.races.map(r => newEntry[r+'Pop']);
        let prison = vis.races.map(r => newEntry[r+'Prison']);

        let maxRate = d3.max(rates);
        let minRate = d3.min(rates);
        let maxPop = d3.max(pops);
        let maxPrison = d3.max(prison);

        if (vis.highestRate < maxRate) vis.highestRate = maxRate;
        if (vis.lowestRate > minRate) vis.lowestRate = minRate;
        if (vis.highestPop < maxPop) vis.highestPop = maxPop;
        if (vis.highestPrison < maxPrison) vis.highestPrison = maxPrison;

        return newEntry;
    });
    vis.initVis();
};

BubbleVis.prototype.initVis = function() {
    let vis = this;


    // define drawing area
    vis.margin = { top: 40, right: 100, bottom: 10, left: 40 };
    vis.width = $(vis.parentElement).width()-(vis.margin.left+vis.margin.right);
    vis.height = 650 - vis.margin.top - vis.margin.bottom;

    vis.svg = d3.select(vis.parentElement).append("svg")
        .attr("width", vis.width + vis.margin.left + vis.margin.right)
        .attr("height", vis.height + vis.margin.top + vis.margin.bottom)
        .append("g")
        .attr("transform", `translate(${vis.margin.left}, ${vis.margin.top})`);


    // init scales //

    // radius scale for bubbles
    vis.radius = d3.scaleSqrt()
        .domain([0, vis.highestRate])
        .range([0, 40]);

    // color scale (to be consistent with previous vis, bubbles colored by race)
    vis.color = d3.scaleOrdinal()
        .domain(vis.races)
        .range(colors);

    // row/col scales for cartogram placement
    vis.x = d3.scaleBand()
        .domain(d3.range(
            d3.min(vis.data, d => d.col),
            d3.max(vis.data, d => d.col) + 1
        ))
        .range([0, vis.width])
        .paddingInner(0.05);

    vis.y = d3.scaleBand()
        .domain(d3.range(
            d3.min(vis.data, d => d.row),
            d3.max(vis.data, d => d.row) + 1
        ))
        .range([0, vis.height])
        .paddingInner(0.5);

    // scales for rosling-view axes
    vis.totalPopScale = d3.scaleLinear()
        .range([vis.height - 50, 30]);

    vis.incarceratedPopScale = d3.scaleLinear()
        .range([30, vis.width - 125]);

    // init choice marker for race-selection
    vis.svg
        .append("rect")
        .attr("class", "choice-marker")
        .attr("width", "45")
        .attr("height", "2")
        .attr("x", 970.5) 
        .attr("y", 85) // 'Latino' label coordinates (initial choice)
        .style("fill", "white");

    // race selection
    vis.svg.selectAll("text.bubble-race-choice")
        .data(vis.races, d=>d)
        .enter()
        .append("text")
        .attr("class", (_,i) => `bubble-race-choice, choice-${i}`)
        .attr("text-anchor", "middle")
        .attr("x", vis.width + 55)
        .attr("y", (_,i) => (vis.height/15)*i)
        .style("fill", "white")
        .text(d => d)
        .on("mouseover", function() {
            d3.select(this)
                .style("fill", "yellow")
                .style("cursor", "pointer");
        })
        .on("mouseout", function() {
            d3.select(this)
                .style("fill", "white")
        })
        .on("click", function(d,i){
            vis.selectedRace = d;
            vis.svg.select(".choice-marker")
                .transition().duration(400)
                .attr("x", vis.width + 32.5)
                .attr("y", (vis.height/15)*i + 5);
            vis.updateVis();
        });

    // change view button to toggle between rosling chart and cartogram
    vis.svg
        .append("text")
        .attr("class", "bubble-view-choice")
        .attr("text-anchor", "middle")
        .attr("x", vis.width + 30)
        .attr("y", vis.height/3 + 18)
        .style("fill", "lightblue")
        .style("font-size", "18px")
        .text("Change View")
        .on("mouseover", function() {
            d3.select(this)
                .style("fill", "yellow")
                .style("cursor", "pointer");
        })
        .on("mouseout", function() {
            d3.select(this)
                .style("fill", "lightblue")
        })
        .on("click", function() {
            vis.rosling = !vis.rosling;

            if (vis.rosling) {
                // creation of axes and transition by toggle button when toggling to rosling-view
                // necessary to have both intra-rosling race-based axis tick transitions and inter-view axis sliding animation
                vis.justToggled = true;

                // update scales an axes
                vis.incarceratedPopScale.domain([0, d3.max(vis.data, d => d[vis.selectedRace + 'Prison'])]);
                vis.xAxis = d3.axisBottom(vis.incarceratedPopScale);
                vis.totalPopScale.domain([0, d3.max(vis.data, d => d[vis.selectedRace + 'Pop'])]);
                vis.yAxis = d3.axisLeft(vis.totalPopScale);

                // slide in axes
                vis.svg.select("g.x-axis-bubble")
                    .attr("transform", `translate(-1000, ${vis.height - 50})`)
                    .transition().duration(800)
                    .attr("transform", `translate(0, ${vis.height - 50})`)
                    .call(vis.xAxis);

                vis.svg.select("g.y-axis-bubble")
                    .attr("transform", "translate(-1000, 0)")
                    .transition().duration(800)
                    .attr("transform", "translate(30, 0)")
                    .call(vis.yAxis.ticks(7));

                // add axis titles to axis groups
                vis.svg.select(".x-axis-bubble")
                    .append("text")
                    .attr("x", vis.width - 125)
                    .attr("y", -10)
                    .attr("text-anchor", "end")
                    .style("font-size", "15px")
                    .text("Incarcerated Race Population");

                vis.svg.select(".y-axis-bubble")
                    .append("text")
                    .attr("x", 0)
                    .attr("y", 20)
                    .attr("text-anchor", "start")
                    .style("font-size", "15px")
                    .text("Total Race Population");
            }

            else {
                // on toggle back to state/cartogram view, slide axes out
                vis.svg.select(".x-axis-bubble")
                    .transition().duration(800)
                    .attr("transform", `translate(-1000, ${vis.height - 50})`);
                vis.svg.select(".y-axis-bubble")
                    .transition().duration(800)
                    .attr("transform", "translate(-1000, 0)");
            }

            // update vis on toggle
            vis.updateVis();
        });

    // legend
    vis.svg.append("g")
        .attr("class", "legendSize")
        .attr("transform", `translate(${vis.width-15}, 270)`)
        .style("stroke", "white")
        .style("stroke-width", "1px");

    vis.legendSize = d3.legendSize()
        .scale(vis.radius)
        .shape('circle')
        .cells([.005, .01, .02, .04, .08])
        .shapePadding(30)
        .labelOffset(20)
        .labelFormat(".1%");

    vis.svg.select(".legendSize")
        .call(vis.legendSize);

    // init axis groups
    vis.svg.append("g").attr("class", "x-axis-bubble");
    vis.svg.append("g").attr("class", "y-axis-bubble");

    // initial conditions
    // vis.selectedRace = "White";
    vis.selectedRace="Latino";
    vis.rosling = false;
    vis.toggleCount = 0;
    vis.updateVis();
};

BubbleVis.prototype.updateVis = function() {
    let vis = this;

    // transition axes unless rosling-view was just toggled (in which case it's handled by the toggler)
    // needed to do it this way to be able to have axis ticks transition as well as axes sliding in on toggle
    if (vis.justToggled) {
        vis.justToggled = false;
    }
    else if (vis.rosling) {
        console.log("hello");
        vis.incarceratedPopScale.domain([0, d3.max(vis.data, d => d[vis.selectedRace + 'Prison'])]);
        vis.xAxis = d3.axisBottom(vis.incarceratedPopScale);
        vis.svg.select("g.x-axis-bubble")
            .attr("transform", `translate(0, ${vis.height - 50})`)
            .transition().duration(800)
            .call(vis.xAxis);

        vis.totalPopScale.domain([0, d3.max(vis.data, d => d[vis.selectedRace + 'Pop'])]);
        vis.yAxis = d3.axisLeft(vis.totalPopScale);
        vis.svg.select("g.y-axis-bubble")
            .attr("transform", "translate(30, 0)")
            .transition().duration(800)
            .call(vis.yAxis.ticks(7));
    }


    // compute tooltip values for current conditions and setup tooltip
    vis.tip = d3.tip()
        .attr('class', 'd3-tip')
        .html(function(d) {
            let r = vis.selectedRace;
            let f = Math.round(1/d[vis.selectedRace+'Rate']);
            let p = d3.format(".02%")(d[vis.selectedRace+'Rate']);
            let s = `<h4>${d.Name} (${p})</h4>
                    1 in ${f} ${r} people are incarcerated`;
            if (vis.rosling) {
                return `<p>${s}</p> <p>${r} population: ${d3.format(",")(d[r+'Pop'])} </p>
                          <p> ${r} incarcerated population: ${d3.format(",")(d[r+'Prison'])} </p>`;
            }
            else return s;

        });
    vis.svg.call(vis.tip);


    // enter-merge loop for bubbles, including hover -> tooltip
    vis.bubbles = vis.svg.selectAll(".bubble")
        .data(vis.data, d => d.geo_ID);
    vis.bubbles
        .enter()
        .append("circle")
        .attr("class", "bubble")
        .attr("r", 1e-6)
        .on("mouseover", function(d) {
            vis.tip.show(d);
            d3.select(this).style("cursor", "pointer");
        })
        .on("mouseout", function(d) {
            vis.tip.hide(d);
        })
        .merge(vis.bubbles)
        .transition().duration(1000)
        .attr("fill", vis.color(vis.selectedRace))
        .attr("fill-opacity", function(d) {
            if (vis.rosling) {
                return 0.7;
            }
            else return 1;
        })
        .attr("cx", function(d) {
            if (vis.rosling) {
                return vis.incarceratedPopScale(d[vis.selectedRace+'Prison']);
            }
            else return vis.x(d.col);
        })
        .attr("cy", function(d) {
            if (vis.rosling) {
                return vis.totalPopScale(d[vis.selectedRace+'Pop']);
            }
            else return vis.y(d.row);
        })
        .attr("r", d => vis.radius(d[vis.selectedRace+'Rate']));


    // enter-merge loop for labels, including hover -> percentage point differentials
    vis.labels = vis.svg.selectAll(".state-id")
        .data(vis.data);
    vis.labels
        .enter()
        .append("text")
        .attr("class", "state-id")
        .attr("text-anchor", "middle")
        .attr("font-size", "12px")
        .attr("x", vis.width/2)
        .attr("y", vis.height/2)
        .on("mouseover", function(d) {
            d3.select(this).style("cursor", "pointer");
            if (!vis.rosling) {
                vis.svg.selectAll("text.percentage-point-diff")
                    .data(vis.data, e => e.geo_ID)
                    .enter()
                    .append("text")
                    .attr("class", "percentage-point-diff")
                    .attr("x", e => vis.x(e.col) - 28)
                    .attr("y", e => vis.y(e.row) + 10)
                    .attr("fill-opacity", 0)
                    .transition().duration(300)
                    .attr("fill-opacity", 1)
                    .attr("y", function (e) {
                        if (vis.selectedRace !== "Black") return vis.y(e.row) - vis.radius(e[vis.selectedRace+'Rate']) - 5;
                        else return vis.y(e.row)+5;
                    })
                    .style("fill", function(e) {
                        let disp = (e[vis.selectedRace + 'Rate'] - d[vis.selectedRace + 'Rate']) * 100;
                        let fmt = d3.format("+.2f")(disp);
                        if (fmt < 0) {
                            return "lightgreen";
                        }
                        else if (fmt === "+0.00") return "gray";
                        else return "red";
                    })
                    .text(function (e) {
                        let disp = (e[vis.selectedRace + 'Rate'] - d[vis.selectedRace + 'Rate']) * 100;
                        return d3.format("+.2f")(disp);
                    });
            }
        })
        .on("mouseout", function(d) {
            vis.svg.selectAll("text.percentage-point-diff")
                .transition().duration(300)
                .attr("y", e => vis.y(e.row))
                .attr("fill-opacity", 0)
                .remove();
        })
        .merge(vis.labels)
        .transition().duration(1000)
        .attr("x", d => vis.x(d.col))
        .attr("y", function(d) {
            if (!vis.rosling) {
                return vis.y(d.row) + vis.radius(d[vis.selectedRace + 'Rate']) + 13;
            }
            else return 1000;
        })
        .style("fill", "white")
        .text(d => d.geo_ID);

};