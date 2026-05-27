const fs = require('fs');
const html = fs.readFileSync('file_20260527101835_9050.html', 'utf8');

let dataObj = null;

try {
    const dataRawMatch = html.match(/<body[^>]*data-raw="([^"]+)"/);
    if (dataRawMatch) {
        let raw = dataRawMatch[1];
        // data-raw is often URL encoded in mochawesome
        raw = raw.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        try {
            raw = decodeURIComponent(raw);
        } catch (e) {
            // ignore
        }
        dataObj = JSON.parse(raw);
    }
} catch (e) {
    console.error("Failed parsing data-raw:", e.message);
}

if (!dataObj) {
    try {
        const scriptMatch = html.match(/<script>\s*window\.marge\s*=\s*(\{.*?\})\s*;\s*<\/script>/);
        if (scriptMatch) {
            dataObj = JSON.parse(scriptMatch[1]);
        }
    } catch (e) {
        console.error("Failed parsing window.marge:", e.message);
    }
}

if (!dataObj) {
    // maybe just extract all error messages from the raw HTML text
    console.log("Could not find structured JSON data.");
    const errorMatches = html.match(/"err":\{"message":"([^"]+)"/g);
    if (errorMatches) {
        console.log(`Found ${errorMatches.length} raw error patterns.`);
        const counts = {};
        errorMatches.forEach(m => {
            let msg = m.replace(/"err":\{"message":"/, '').replace(/"$/, '');
            counts[msg] = (counts[msg] || 0) + 1;
        });
        for (const [msg, count] of Object.entries(counts)) {
            console.log(`\nERROR (${count} times): ${msg}`);
        }
    } else {
        console.log("No raw error patterns found.");
    }
    process.exit(0);
}

const failures = [];

function traverse(suite) {
    if (suite.tests) {
        suite.tests.forEach(test => {
            if (test.fail) {
                failures.push({
                    title: test.title,
                    fullTitle: test.fullTitle,
                    error: test.err ? test.err.message : 'Unknown error',
                });
            }
        });
    }
    if (suite.suites) {
        suite.suites.forEach(traverse);
    }
}

if (dataObj.results) {
    dataObj.results.forEach(traverse);
} else if (dataObj.report && dataObj.report.results) {
    dataObj.report.results.forEach(traverse);
}

console.log(`Found ${failures.length} failed tests.`);

const errorGroups = {};
failures.forEach(f => {
    const cleanError = f.error.split('\\n')[0].substring(0, 300); 
    if (!errorGroups[cleanError]) {
        errorGroups[cleanError] = [];
    }
    errorGroups[cleanError].push(f.fullTitle);
});

for (const [err, tests] of Object.entries(errorGroups)) {
    console.log('\\n========================================');
    console.log(`ERROR (${tests.length} tests): ${err}`);
    console.log('Examples:');
    tests.slice(0, 3).forEach(t => console.log(' - ' + t));
}
