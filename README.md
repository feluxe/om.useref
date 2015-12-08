# om.useref
npm useref for nodejs

Concat and Process js/css files that are linked in a HTML file via <script>/<link> tag.
Create a new HTML file that links only to the concatenated css/js files.

Example HTML:
```
<!-- build:js/app.min.js -->
    <script src="js/plugin1.js"></script>
    <script src="js/plugin2.js"></script>
    ...
<!-- end build -->
<!-- build:css/app.min.css -->
    <link src="js/plugin1.css">
    <link src="js/plugin2.css">
    ...
<!-- end build -->
```


