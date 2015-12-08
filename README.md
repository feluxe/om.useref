# om.useref
###### npm useref build script for node.js

Concatenate and uglify/minify js/css files that are linked in a HTML file via `<script>/<link>` tags and save them.
Create a new HTML file from the source HTML file that links only to the new concatenated css/js files.

#### Example:

###### Source file HTML:
Define destination path behind `build:`
```
<!-- build:js/app.min.js -->
    <script src="js/plugin1.js"></script>
    <script src="js/plugin2.js"></script>
    ...
<!-- end build -->
<!-- build:css/app.min.css -->
    <link href="css/plugin1.css">
    <link href="css/plugin2.css">
    ...
<!-- end build -->
```

###### Destination file HTML:
`js/app.min.js` and `css/app.min.css` are created from source files.
```
<script src="js/app.min.js"></script>
<link href="css/app.min.css">
```

###### Call function like that:
```
var om = require('om.useref');                      // Load Module.

var srcIndexFile = "app/index.php";                 // Path to source HTML file.
var destIndexFile = "dist/index.php";               // Path to destination HTML file.

om.useref(srcIndexFile, destIndexFile);             // Execute.
```

###### ES6 Promise integrated:
```
om.useref(srcIndexFile, destIndexFile).then(function(){
    // Do Stuff when useref finished... 
}).catch(err){
    // track Errors.
});
```
