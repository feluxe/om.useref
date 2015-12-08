# om.useref
npm useref for nodejs

Concat and Process js/css files that are linked in a HTML file via ```<script>/<link>``` tag.
Create a new HTML file that links only to the concatenated css/js files.

Example:

Source HTML
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

Output HTML
```
<script src="js/app.min.js"></script>
<link href="css/app.min.css">
```

Call function like that:
```
var om = require('om.useref');
om.useref(srcIndexFile, destIndexFile);
```

ES6 Promise integrated:
```
om.useref(srcIndexFile, destIndexFile).then(function(){
    // Do Stuff when useref finished... 
}).catch(err){
    // track Errors.
});
```
