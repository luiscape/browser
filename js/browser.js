d3.json('index.json').on('load', function(index) {

    // Build initial title listing
    var titles = d3.select('#titles')
        .selectAll('li.title')
        .data(index.titles);

    var li = titles
        .enter()
        .append('li')
        .attr('class', 'title')
        .on('click', clickTitle)
        .append('div')
        .attr('class', 'clearfix');

    li.append('span')
        .attr('class', 'number')
        .text(function(d) { return d[0]; });

    li.append('span')
        .attr('class', 'name')
        .text(function(d) { return d[1]; });

    function clickTitle(d) {
        router.setRoute(d[0]);
        updateTitle(d[0]);
    }

    function findTitle(t) {
        var title = titles
            .classed('active', function(d) { return d[0] === t; })
            .filter(function(d,i) { return d[0] == t; });
        // if (title.empty()) {
        //     alert("Title " + t + " does not exist in the current DC code.");
        //     return;
        // }
        var d = title.data()[0];
        updateTitle(d[0]);
        sectionsFor(d);

        d3.select('.titles-container').classed('selected', true);
        d3.select('.sections-container').classed('selected', false);

        //Scroll to the item if we can't already see it
        var top = title.property('offsetTop'),
            tc = d3.select('.titles-container');

        if (top > tc.property('scrollTop') + tc.property('offsetHeight') - 35) {
            tc.property('scrollTop',top - 35);
        }

        d3.select('.content #section').html('');
    }

    function findSection(t, s) {
        updateTitle(s);
        // Only refresh section list if we're changing titles
        var currentTitle = d3.select(".title.active");
        if (currentTitle.empty() || currentTitle.data()[0][0] != t) {
            findTitle(t);
        }

        var sections = d3.select('#sections')
            .selectAll('li.section')
            .classed('active',function(d) { return d[0] === s; });
        var section = sections
            .filter(function(d, i){ return d[0] === s; });

        // Handle what happens if we specify an invalid section.  TODO: Do this better
        if (section.empty()) {
            return;
        }

        // Scroll to the right part of the sections list if we can't see it
        var sectionsContainer = d3.select('.sections-container');
        if (section.property('offsetTop') > sectionsContainer.property('scrollTop') + sectionsContainer.property('offsetHeight')){
            sectionsContainer.property('scrollTop',section.property('offsetTop')-35);
        }

        doSection(section.data()[0]);
    }

    // Show an actual section text - header, historical notes, and so on.
    function doSection(d) {
        d3.select('#section').classed('loading', true);
        d3.json('sections/' + d[0] + '.json').on('load', function(section) {
            d3.select('#section').classed('loading', false);
            var s = d3.select('#section');

            d3.select('.sections-container').classed('selected', true);

            var content = s.selectAll('div.content')
                .data([section], function(d) { return JSON.stringify(d); });

            content.exit().remove();

            var div = content.enter()
                .append('div')
                .attr('class', 'content')
                .property('scrollTop',0);

            div.append('h1')
                .attr('class', 'pad2')
                .attr('id', 'article-title')
                .text(function(d) {
                    return d.heading.catch_text;
                });

            if (section.text) {
                div.append('div')
                    .attr('class', 'section-text pad2')
                    .selectAll('p')
                    .data(function(d) {
                        return section.text.split(/\n+/);
                    })
                    .enter()
                    .append('p')
                    .html(function(d) {
                        return cited(d);
                    });
            }

            var sections = div.append('div')
                .attr('class', 'pad2')
                .selectAll('section')
                .data(section.sections, function(d) {
                    return d.prefix + d.text;
                });

            function sectionClass(d) {
                var c = '';
                if (d.prefix.match(/([a-z])/)) c = 'section-1';
                else if (d.prefix.match(/([0-9])/)) c = 'section-2';
                else if (d.prefix.match(/([A-Z])/)) c = 'section-3';
                return c;
            }

            var sectionelem = sections.enter()
                .append('section')
                .attr('class', sectionClass);

            sections.exit().remove();

            var section_p = sectionelem.append('p');

            section_p.append('span')
                .attr('class', 'section-prefix')
                .text(function(d) {
                    return d.prefix;
                });

            section_p.append('span')
                .html(function(d) {
                    return cited(d.text);
                });

            if (section.credits) {
                var credits = div.append('div')
                    .attr('class', 'pad2 limited-text');
                credits.append('h4')
                    .text('Credits');
                credits.append('p')
                    .html(function(d) {
                        return cited(d.credits);
                    });
            }

            if (section.historical) {
                var history = div.append('div')
                    .attr('class', 'pad2 limited-text');
                history.append('h4')
                    .text('Historical and Statutory');
                history.append('p')
                    .html(function(d) {
                        return cited(d.historical);
                    });
            }

            var downloads = div.append('p').attr('class', 'pad1');

            downloads.append('span').text('download: ');

            downloads.append('a')
                .text(function(d) {
                    return d.heading.identifier + '.json';
                })
                .attr('href', function(d) {
                    return 'sections/' + d.heading.identifier + '.json';
                });

        }).get();
    }

    function doesNotApply(d) {
        return d[1].match(/\[(Repealed|Omitted|Expired)\]/g);
    }

    function cited(text) {
        return Citation.find(text, {
            context: {
                dc_code: {
                    source: 'dc_code'
                }
            },
            excerpt: 40,
            types: ['dc_code', 'dc_register', 'law', 'stat'],
            replace: {
                dc_code: codeCited,
                law: lawCited,
                dc_register: dcrCited,
                stat: statCited
            }
        }).text;
    }

    // is this a current DC Code cite (something we should cross-link),
    // or is it to a prior version of the DC Code?
    function codeCited(cite) {
        var index = cite.excerpt.search(/ior\s+codifications\s+1981\s+Ed\.?\,?/i);
        if (index > 0 && index < 40) // found, and to the left of the cite
            return;

        var url = "#/" + cite.dc_code.title + "/" + cite.dc_code.title + "-" + cite.dc_code.section;
        return linked(url, cite.match);
    }

    function lawCited(cite) {
        var lawName = cite.law.type + " law " + cite.law.congress + "-" + cite.law.number;
        var url = 'http://www.govtrack.us/search?q=' + encodeURIComponent(lawName);
        return linked(url, cite.match);
    }

    // just link to that year's copy on the DC Register website
    function dcrCited(cite) {
        if (parseInt(cite.dc_register.volume, 10) < 57)
            return;
        
        var year = parseInt(cite.dc_register.volume, 10) + 1953;
        var url = 'http://www.dcregs.dc.gov/Gateway/IssueList.aspx?IssueYear=' + year;

        return linked(url, cite.match);
    }

    function statCited(cite) {
        if (parseInt(cite.stat.volume, 10) < 65)
            return;

        var url = 'http://api.fdsys.gov/link?collection=statute&volume=' + cite.stat.volume + '&page=' + cite.stat.page;
        return linked(url, cite.match);
    }

    function linked(url, text) {
        return "<a href=\"" + url + "\">" + text + "</a>";
    }


    function sectionsFor(title) {

        var data = index.sections.filter(function(s) {
            return s[0].match(/(\d+)\-/)[1] == title[0];
        });

        doSections(data);
    }

    function searchSection(s) {
        return index.sections.map(function(s) {
            return {
                title: s[0] + ' ' + s[1],
                value: s[0] + ' ' + s[1],
                type: 'section'
            };
        });
    }

    // Show a list of sections
    function doSections(data) {

        function clickSection(d) {
            router.setRoute(1,d[0]);
            updateTitle(d[0]);
        }

        // build section list
        var sections = d3.select('#sections')
            .selectAll('li.section')
            .data(data, function(d) { return d[0]; });

        sections.exit().remove();

        var li = sections
            .enter()
            .append('li')
            .attr('class', 'section clearfix')
            .classed('repealed', doesNotApply)
            .on('click', clickSection);

        li.append('span')
            .attr('class', 'section-number')
            .text(function(d) { return d[0]; });

        li.append('span')
            .attr('class', 'section-name')
            .text(function(d) { return d[1]; });
    }

    function updateTitle(title) {
        d3.select('#code-identifier').text(title ? ('§ ' + title) : '');
    }

    var s = search(),
        combobox = d3.combobox();

    var title_search = d3.select('#search-title').on('keyup', function() {
            if (!this.value) return;
            if (this.value.match(/^(\d)\-/)) {
                return combobox.data(searchSection(this.value));
            }
            s.autocomplete(this.value, function(results) {
                combobox.data(results.map(function(r) {
                    return {
                        title: r,
                        value: r
                    };
                }));
            });
        })
        .call(combobox)
        .on('change', function() {
            var data = combobox.data();
            if (!data.length) return;
            if (data[0].type === 'section') {
                var path = this.value.split(' ')[0];
                var title = path.match(/^([\d]+)/)[0];
                router.setRoute(title + '/' + path);
                this.value = '';
                return;
            }
            s.query(this.value, function(d) {
                doSections(d.map(function(o) {
                    return o.title;
                }));
            });
        });

    var routes = {
        '#/:title': findTitle,
        '#/:title/:section': findSection
    };

    router = Router(routes);
    router.init();

    function keyMove(dir) {
        return function() {
            var sections = d3.select('#sections')
                .selectAll('li.section'), i = null;
            sections.each(function(_, ix) {
                if (d3.select(this).classed('active')) i = ix;
            });
            if (i === null ||
                (dir === -1 && i === 0) ||
                (dir === 1 && i === sections[0].length - 1)) return;
            d3.select(sections[0][i + dir]).trigger('click');
        };
    }

    d3.select(document)
        .call(d3.keybinding('arrows')
            .on('←', keyMove(-1))
            .on('→', keyMove(1)));
}).get();
