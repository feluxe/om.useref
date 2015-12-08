
/** Modules */
var fs = require('fs-extra');
var path = require('path');
var UglifyJS = require("uglify-js");
var CleanCSS = require('clean-css');

var om = {};
/**
 * Useref Function.
 *
 * @param srcIndexFile
 * @param destIndexFile
 */
om.useref = function(srcIndexFile, destIndexFile) {

    /**
     * Read Source Index File to get asset src.
     *
     * @param srcPath
     * @returns {Promise}
     */
    var readSourceIndexFile = function (srcPath) {
        return new Promise(function (resolve, reject) {
            fs.readFile(srcPath, {encoding: 'utf-8'}, function (err, data) {
                if (err) reject(err);
                resolve(data);
            })
        });
    };
    /**
     * Make dir and save file.
     *
     * @param dest
     * @param data
     */
    var saveFile = function (dest, data) {
        console.log('NEW: '+dest);
        return new Promise(function (resolve, reject) {
            fs.mkdirp(path.dirname(dest), function (err) {
                if (err) reject(err);
                fs.writeFile(dest, data, function (err) {
                    if (err) reject(err);
                    resolve("FILE SAVED: " + dest);
                });
            });
        });
    };
    /**
     * Make Data Blocks.
     * Goes through index code and puts each build tag block (<!-- build: ... -->...<!-- end build -->) into an arr.
     *
     * @param data
     * @returns {Promise}
     */
    var makeDataBlocks = function (data) {
        return new Promise(function (resolve, reject) {

            var dataArr = [], startPos = 0, endPos = 0;

            for (var i = 0; i > -1; i++) {

                /** Get starting and ending position of each block */
                startPos = data.indexOf("<!-- build:", startPos + i);
                endPos = data.indexOf("<!-- end build -->", endPos + i);

                /** Only succeed if both (start/end) anchor tags were found. If none is found end the loop */
                if (startPos == -1 && endPos == -1) {
                    i = -5;
                } else if (startPos > -1 && endPos < 0) {
                    i = -5;
                    reject("Error: Missing End Anchor Tag");
                } else if (startPos < 0 && endPos > -1) {
                    i = -5;
                    reject("Error: Missing startPos Anchor Tag");
                } else {
                    var currentBlock = (data.slice(startPos, endPos + 18));
                    dataArr.push(currentBlock);
                }
            }
            resolve(dataArr);
        });
    };
    /**
     * Make Data Rows.
     * Go through block array.
     * Split each block into its rows.
     * Put all rows into one arr.
     *
     * @param dataBlocks
     * @returns {Promise}
     */
    var makeDataRows = function (dataBlocks) {
        return new Promise(function (resolve, reject) {

            var dataRows = [], curLines = [];

            dataBlocks.forEach(function (curBlock) {

                /** Get content of first Line. */
                var endPos = curBlock.indexOf(" -->");
                var firstLine = curBlock.slice(11, endPos).trim();

                /** Identify .js or .css. Then split on <script> or <link> tag. */
                if (firstLine.indexOf(".js") > -1) {
                    curLines = curBlock.split('</script>');
                } else if (firstLine.indexOf(".css") > -1) {
                    curLines = curBlock.split('<link ');
                } else {
                    reject("Error: Unable to identify build Type");
                }

                /** Put each line into array */
                curLines.forEach(function (curLine) {
                    if (curLine) {
                        dataRows.push(curLine);
                    }
                });
            });
            resolve(dataRows);
        });
    };
    /**
     * Make Paths.
     * Slice out each destination file name and put it into resulting obj.
     * Slice out each row until only the path is left.
     * Put each clean Path to its destination file into resulting obj.
     *
     * @param dataRows
     * @returns {Promise}
     */
    var makePaths = function (dataRows) {
        return new Promise(function (resolve, reject) {

            var curFileName, startPos, endPos, type = false, pathObj = {};

            dataRows.forEach(function (curRow) {

                /**  If current row has a start anchor tag, extract file name. */
                if (curRow.indexOf('<!-- build:') > -1) {
                    startPos = curRow.indexOf("<!-- build:");
                    endPos = curRow.indexOf(" -->");
                    curFileName = curRow.slice(11, endPos).trim();

                    /** If the current File name has no Property in the Object yet,
                     * create a new Property with filename as name and with empty arr as value. */
                    if (!pathObj[curFileName]) pathObj[curFileName] = [];
                }

                /** Define if current row is of css or js type. */
                if (curRow.indexOf('href') > -1) {
                    type = "css";
                    startPos = curRow.indexOf('href');
                } else if (curRow.indexOf('src') > -1) {
                    type = "js";
                    startPos = curRow.indexOf('src');
                } else {
                    type = false;
                }

                /** Extract path from line */
                if (type) {

                    /** look for " and ' */
                    var curPath = curRow.slice(startPos);
                    var trySingleQuote = curPath.indexOf("'");
                    var tryDoubleQuote = curPath.indexOf('"');

                    if (trySingleQuote == -1 && tryDoubleQuote == -1) {
                        /** If no quotes '' or "" are found after src/href attr => Err */
                        reject('Error: src/href path not escaped with "" or \'\'');

                    } else if (trySingleQuote != -1 && tryDoubleQuote != -1) {
                        /** If both '' or "" are found after src/href attr => Choose the type that is closer to src/href attr. */
                        startPos = (trySingleQuote < tryDoubleQuote ? trySingleQuote : tryDoubleQuote);
                        endPos = (trySingleQuote < tryDoubleQuote ? curPath.indexOf("'", startPos) : curPath.indexOf('"', startPos));

                    } else if (trySingleQuote == -1) {
                        /** If '' are found after src/href attr => Choose ''. */
                        startPos = tryDoubleQuote + 1;
                        endPos = curPath.indexOf('"', startPos);

                    } else if (tryDoubleQuote == -1) {
                        /** If "" are found after src/href attr => Choose "". */
                        startPos = trySingleQuote + 1;
                        endPos = curPath.indexOf("'", startPos);
                    }

                    /** If Path was found, add base dir to it and put into array. Else error. */
                    if (endPos == -1) {
                        reject('Error: missing " or \' in path string.');
                    } else {
                        curPath = curPath.slice(startPos, endPos).trim();

                        /** complete path */
                        var srcBaseDir = path.dirname(srcIndexFile);
                        if (srcBaseDir) {
                            curPath = srcBaseDir + '/' + curPath;
                        }
                        curPath = path.normalize(curPath);
                        /** Normalize Path */

                        pathObj[curFileName].push(curPath);
                    }
                }
            });
            resolve(pathObj);
        });
    };
    /**
     * Make Destination File Content.
     * Replace each build tag block (<!-- build:... -->...<!-- end build -->) with tag to its resulting scr file.
     *
     * @param sourceData
     * @param dataBlocks
     * @returns {*}
     */
    return new Promise(function (resolve, reject) {
        var makeDestFileContent = function (sourceData, dataBlocks) {

            var newFileName, newTag, type;
            var newData = sourceData;

            dataBlocks.forEach(function (curBlock) {

                var endPos = curBlock.indexOf(" -->");
                newFileName = curBlock.slice(11, endPos).trim();

                if (newFileName.indexOf(".js") > -1) {
                    newTag = '<script src="' + newFileName + '"></script>';
                    newData = newData.replace(curBlock, newTag);
                } else if (newFileName.indexOf(".css") > -1) {
                    newTag = '<link href="' + newFileName + '" rel="stylesheet" type="text/css">';
                    newData = newData.replace(curBlock, newTag);
                }
            });
            return newData;
        };

        /**
         * Useref Function Constructor
         */

        /**
         * Read Source File.
         */
        readSourceIndexFile(srcIndexFile)
            .then(function (data) {
                /** Put Source of Index file on Property */
                om.srcFileContent = data;
                /** Make Data Blocks */
                return makeDataBlocks(data);

            }).then(function (dataBlocks) {
            /** Save Output index File. */
            var newContent = makeDestFileContent(om.srcFileContent, dataBlocks);
            saveFile(destIndexFile, newContent);
            /** Make Rows out of Data Blocks */
            return makeDataRows(dataBlocks);

        }).then(function (dataRows) {
            /** Make paths out of Rows */
            return makePaths(dataRows);

        }).then(function (pathObj) {

            var i = 0;
            for (var curFile in pathObj) {
                i++;
                if (pathObj.hasOwnProperty(curFile)) {
                    var paths = pathObj[curFile];
                    var destPath = path.dirname(destIndexFile);

                    /** minify/uglify code of each input file. Concatenate each group of files. Save new files. */
                    if (curFile.split('.').pop() == "js") {
                        var miniJs = UglifyJS.minify(paths);
                        saveFile(destPath + '/' + curFile, miniJs.code);
                    } else if (curFile.split('.').pop() == "css") {
                        var miniCSS = new CleanCSS({rebase: false}).minify(paths).styles;
                        saveFile(destPath + '/' + curFile, miniCSS);
                    }
                }
                /** If all new minified files created and saved, end the loop */
                if(i >= Object.keys(pathObj).length){
                    console.log('Useref done...\n');
                    resolve();
                }
            }
        }).catch(function (err) {
            /** Echo any caught err */
            reject(err);
        });
    });
};

module.exports = om;