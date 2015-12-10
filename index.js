'use strict';
/**
 * Load Modules
 */
var fs = require('fs-extra');
var path = require('path');
var UglifyJS = require('uglify-js');
var CleanCSS = require('clean-css');
/**
 * The Module Object.
 */
var om = {};
/**
 * Useref Function. The purpose of this module.
 *
 * @param {string} srcIndexPath - path to reference HTML File.
 * @param {string} destIndexPath - path to output HTML File.
 * @return {Promise} - resolve: returns nothing. reject returns err.
 */
om.useref = function(srcIndexPath, destIndexPath) {
  /**
   * Read Source Index File to get asset src.
   *
   * @param {string} srcPath - path to reference HTML File.
   * @return {Promise} resolve: returns string with file content.
   */
  var readSourceIndexFile = function(srcPath) {
    return new Promise(function(resolve, reject) {
      fs.readFile(srcPath, {encoding: 'utf-8'}, function(err, data) {
        if (err) reject(err);
        resolve(data);
      });
    });
  };
  /**
   * Make dir and save file.
   *
   * @param {string} dest - destination path.
   * @param {string} data - file content.
   * @return {Promise} - resolve: nothing. reject: err.
   */
  var saveFile = function(dest, data) {
    return new Promise(function(resolve, reject) {
      fs.mkdirp(path.dirname(dest), function(err) {
        if (err) reject(err);
        fs.writeFile(dest, data, function(err) {
          if (err) reject(err);
          console.log('NEW: ' + dest);
          resolve();
        });
      });
    });
  };
  /**
   * Make Data Blocks.
   * Goes through index code and puts each build tag block (<!-- build: ... -->...<!-- end build -->) into an arr.
   *
   * @param {string} data - source file content.
   * @return {Promise} - resolve: array of <link>/<script> tags that are between <!-- build: ... -->...<!-- end build -->
   *                      reject:err;
   */
  var makeDataBlocks = function(data) {
    return new Promise(function(resolve, reject) {
      var dataArr = [];
      var startPos = 0;
      var endPos = 0;

      for (var i = 0; i > -1; i++) {
        /** Get starting and ending position of each block */
        startPos = data.indexOf('<!-- build:', startPos + i);
        endPos = data.indexOf('<!-- end build -->', endPos + i);

        /** Only succeed if both (start/end) anchor tags were found. If none is found end the loop */
        if (startPos === -1 && endPos === -1) {
          i = -5;
        } else if (startPos > -1 && endPos < 0) {
          i = -5;
          reject('Error: Missing End Anchor Tag');
        } else if (startPos < 0 && endPos > -1) {
          i = -5;
          reject('Error: Missing startPos Anchor Tag');
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
   * @param {Array} dataBlocks - array of <link>/<script> tags that are between "build:" and "end build".
   * @return {Promise} - resolve: array with rows.
   */
  var makeDataRows = function(dataBlocks) {
    return new Promise(function(resolve, reject) {
      var dataRows = [];
      var curLines = [];

      dataBlocks.forEach(function(curBlock) {
        /** Get content of first Line. */
        var endPos = curBlock.indexOf(' -->');
        var firstLine = curBlock.slice(11, endPos).trim();

        /** Identify .js or .css. Then split on <script> or <link> tag. */
        if (firstLine.indexOf('.js') > -1) {
          curLines = curBlock.split('</script>');
        } else if (firstLine.indexOf('.css') > -1) {
          curLines = curBlock.split('<link ');
        } else {
          reject('Error: Unable to identify build Type');
        }

        /** Put each line into array */
        curLines.forEach(function(curLine) {
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
   * Slice out each destination file path from  <!-- build:path/file.ext -->
   * Slice out each src/href path from <script>/<link> tag.
   * Put each src/href path to its destination file to which it finally goes.
   *
   * @param {Array} dataRows - array of rows.
   * @return {Promise} - resolve: Obj = {filename1:arrOfPaths, filename2:arrOfPaths, ..}. reject: err.
   */
  var makePaths = function(dataRows) {
    return new Promise(function(resolve, reject) {
      var curFileName;
      var startPos;
      var endPos;
      var type = false;
      var pathObj = {};

      dataRows.forEach(function(curRow) {
        /**  If current row has a start anchor tag, extract file name. */
        if (curRow.indexOf('<!-- build:') > -1) {
          startPos = curRow.indexOf('<!-- build:');
          endPos = curRow.indexOf(' -->');
          curFileName = curRow.slice(11, endPos).trim();

          /** If the current File name has no Property in the Object yet,
           * create a new Property with filename as name and with empty arr as value. */
          if (!pathObj[curFileName]) pathObj[curFileName] = [];
        }

        /** Define if current row is of css or js type. */
        if (curRow.indexOf('href') > -1) {
          type = 'css';
          startPos = curRow.indexOf('href');
        } else if (curRow.indexOf('src') > -1) {
          type = 'js';
          startPos = curRow.indexOf('src');
        } else {
          type = false;
        }

        /** Extract path from line */
        if (type) {
          /** look for " and ' */
          var curPath = curRow.slice(startPos);
          var trySingleQuote = curPath.indexOf('\'');
          var tryDoubleQuote = curPath.indexOf('"');

          if (trySingleQuote === -1 && tryDoubleQuote === -1) {
            /** If no quotes '' or "" are found after src/href attr => Err */
            reject('Error: src/href path not escaped with "" or \'\'');
          } else if (trySingleQuote !== -1 && tryDoubleQuote !== -1) {
            /** If both '' or "" are found after src/href attr => Choose the type that is closer to src/href attr. */
            if (trySingleQuote < tryDoubleQuote) {
              startPos = trySingleQuote;
              endPos = curPath.indexOf('\'', startPos);
            } else {
              startPos = tryDoubleQuote;
              endPos = curPath.indexOf('"', startPos);
            }
          } else if (trySingleQuote === -1) {
            /** If '' are found after src/href attr => Choose ''. */
            startPos = tryDoubleQuote + 1;
            endPos = curPath.indexOf('"', startPos);
          } else if (tryDoubleQuote === -1) {
            /** If "" are found after src/href attr => Choose "". */
            startPos = trySingleQuote + 1;
            endPos = curPath.indexOf('\'', startPos);
          }

          /** If Path was found, add base dir to it and put into array. Else error. */
          if (endPos === -1) {
            reject('Error: missing " or \' in path string.');
          } else {
            curPath = curPath.slice(startPos, endPos).trim();

            /** complete path */
            var srcBaseDir = path.dirname(om.srcIndexPath);
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
   * Uglify JS and Save.
   * @param {Array} paths - array containing all src files of one block, that are to be uglified and concatenated.
   * @param {String} destDir - base dir of destination file.
   * @param {String} curDestFile - destination file name.
   */
  var uglifyJSAndSave = function(paths, destDir, curDestFile) {
    var miniJs = UglifyJS.minify(paths);
    saveFile(destDir + '/' + curDestFile, miniJs.code);
  };
  /**
   * Clean CSS and Save.
   * @param {Array} paths - array containing all src files of one block, that are to be minified and concatenated.
   * @param {String} destDir - base dir of destination file.
   * @param {String} curDestFile - destination file name.
   */
  var cleanCSSAndSave = function(paths, destDir, curDestFile) {
    var miniCSS = new CleanCSS({rebase: false}).minify(paths).styles;
    saveFile(destDir + '/' + curDestFile, miniCSS);
  };
  /**
   * Process each source files.
   * loops over each block.
   * Checks if current block is JS or CSS.
   * Processes block accordingly.
   * @param {Object} pathObj - Object with destination file name and all its src files.
   */
  var processData = function(pathObj) {
    var i = 0;
    for (var curDestFile in pathObj) {
      if (pathObj.hasOwnProperty(curDestFile)) {
        i++;
        var paths = pathObj[curDestFile];
        var destDir = path.dirname(om.destIndexPath);
        if (curDestFile.split('.').pop() === 'js') {
          uglifyJSAndSave(paths, destDir, curDestFile);
        } else if (curDestFile.split('.').pop() === 'css') {
          cleanCSSAndSave(paths, destDir, curDestFile);
        }
      }
      /** If all new files created, minified and saved, end the loop */
      if (i >= Object.keys(pathObj).length) {
        console.log('Useref done...\n');
      }
    }
  };
  /**
   * Make Destination File Content.
   * Replace each build tag block (<!-- build:... -->...<!-- end build -->)
   *    with tag to its resulting scr file.
   *
   * @param {String} sourceData - content of source html file.
   * @param {Array} dataBlocks - arr with blocks of <!-- build:... -->...<!-- end build -->.
   * @return {String} - new file content. Blocks replaced by single <script> or <link> tag.
   */
  var makeDestFileContent = function(sourceData, dataBlocks) {
    var newFileName;
    var newTag;
    var newData = sourceData;

    dataBlocks.forEach(function(curBlock) {
      var endPos = curBlock.indexOf(' -->');
      newFileName = curBlock.slice(11, endPos).trim();

      if (newFileName.indexOf('.js') > -1) {
        newTag = '<script src="' + newFileName + '"></script>';
        newData = newData.replace(curBlock, newTag);
      } else if (newFileName.indexOf('.css') > -1) {
        newTag = '<link href="' + newFileName + '" rel="stylesheet" type="text/css">';
        newData = newData.replace(curBlock, newTag);
      }
    });
    return newData;
  };
  /**
   * Useref Constructor
   * Streaming would probably make sense?
   */
  om.srcIndexPath = path.normalize(srcIndexPath);
  om.destIndexPath = path.normalize(destIndexPath);
  return new Promise(function(resolve, reject) {
    /** Read Index Source File */
    readSourceIndexFile(om.srcIndexPath)
      .then(function(fileContent) {
        om.srcFileContent = fileContent;
        /** Make Data Blocks */
        return makeDataBlocks(om.srcFileContent);
      }).then(function(dataBlocks) {
        om.dataBlocks = dataBlocks;
        /** Make Rows out of Data Blocks */
        return makeDataRows(dataBlocks);
      }).then(function(dataRows) {
        /** Make paths out of Rows */
        return makePaths(dataRows);
      }).then(function(pathObj) {
        /** Make destination index HTML File Content and Save. */
        var newDestFileContent = makeDestFileContent(om.srcFileContent, om.dataBlocks);
        saveFile(om.destIndexPath, newDestFileContent);
        /** minify/uglify each input file. Concatenate each group of files. Save new dest files. */
        processData(pathObj);
        resolve();
      }).catch(function(err) {
        /** Echo any caught err */
        reject(err);
      });
  });
};

module.exports = om;
