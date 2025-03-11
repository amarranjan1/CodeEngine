const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const { exec } = require("child_process");
const cors = require("cors");
const os = require("os");
const { performance } = require("perf_hooks");

const app = express();

// Enable CORS
app.use(cors({
    origin: "*",
    methods: ["POST", "GET"],
    allowedHeaders: ["Content-Type"]
}));

app.use(bodyParser.json());

const executionHistory = [];

const LANGUAGES = {
    python: {
        extension: "py",
        runCmd: (filename, input) => os.platform() === "win32" 
            ? `echo ${input} | python ${filename}`
            : `echo \"${input}\" | python3 ${filename}`
    },
    javascript: {
        extension: "js",
        runCmd: (filename, input) => os.platform() === "win32" 
            ? `echo ${input} | node ${filename}`
            : `echo \"${input}\" | node ${filename}`
    },
    cpp: {
        extension: "cpp",
        compileCmd: (filename, output) => `g++ ${filename} -o ${output}`,
        runCmd: (output, input) => os.platform() === "win32" 
            ? `echo ${input} | ${output}.exe`
            : `echo \"${input}\" | ./${output}`
    },
    c: {
        extension: "c",
        compileCmd: (filename, output) => `gcc ${filename} -o ${output}`,
        runCmd: (output, input) => os.platform() === "win32" 
            ? `echo ${input} | ${output}.exe`
            : `echo \"${input}\" | ./${output}`
    },
    java: {
        extension: "java",
        compileCmd: (filename) => `javac ${filename}`,
        runCmd: (className, input) => os.platform() === "win32" 
            ? `echo ${input} | java ${className}`
            : `echo \"${input}\" | java ${className}`
    }
};

app.post("/execute", async (req, res) => {
    try {
        const { language, source_code, test_cases } = req.body;

        if (!LANGUAGES[language]) {
            return res.status(400).json({ error: "Unsupported language" });
        }

        const langConfig = LANGUAGES[language];
        const filename = `temp.${langConfig.extension}`;
        const outputFile = `temp_out`;

        fs.writeFileSync(filename, source_code);

        const executeCode = (testInput, callback) => {
            const startTime = performance.now();

            if (langConfig.compileCmd) {
                exec(langConfig.compileCmd(filename, outputFile), (err, stderr) => {
                    if (err) {
                        return callback(err, stderr, null);
                    }

                    let runCmd = language === "java" 
                        ? langConfig.runCmd(filename.replace(".java", ""), testInput)
                        : langConfig.runCmd(outputFile, testInput);

                    exec(runCmd, (error, stdout, stderr) => {
                        const endTime = performance.now();
                        const executionTime = (endTime - startTime).toFixed(2);
                        callback(error, stdout, stderr, executionTime);
                    });
                });
            } else {
                exec(langConfig.runCmd(filename, testInput), (error, stdout, stderr) => {
                    const endTime = performance.now();
                    const executionTime = (endTime - startTime).toFixed(2);
                    callback(error, stdout, stderr, executionTime);
                });
            }
        };

        let results = [];

        for (const test of test_cases) {
            await new Promise((resolve) => {
                executeCode(test.input, (error, stdout, stderr, executionTime) => {
                    if (error) {
                        results.push({
                            input: test.input,
                            expected_output: test.expected_output,
                            actual_output: stderr || error.message,
                            execution_time: executionTime,
                            memory_usage: "N/A", 
                            passed: false
                        });
                        return resolve();
                    }

                    const actual_output = stdout.trim();
                    const passed = actual_output === test.expected_output;
                    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;

                    results.push({
                        input: test.input,
                        expected_output: test.expected_output,
                        actual_output,
                        execution_time: executionTime + " ms",
                        memory_usage: memoryUsage.toFixed(2) + " MB",
                        passed
                    });
                    resolve();
                });
            });
        }

        executionHistory.push({ timestamp: new Date(), results });

        fs.unlinkSync(filename);
        if (langConfig.compileCmd) {
            if (language === "java") {
                fs.unlinkSync(filename.replace(".java", ".class"));
            } else {
                fs.unlinkSync(`${outputFile}${os.platform() === "win32" ? ".exe" : ""}`);
            }
        }

        res.json({ status: "Success", results });

    } catch (err) {
        res.status(500).json({ status: "Error", error: err.message });
    }
});

app.get("/execution-data", (req, res) => {
    res.json({ history: executionHistory });
});

app.listen(3000, () => console.log("✅ Server running on port 3000"));
