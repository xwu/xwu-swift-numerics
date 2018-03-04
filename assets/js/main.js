$(function() {
  $("article h1, article h2").each(function() {
    $("nav ul").append("<li class='tag-" + this.nodeName.toLowerCase() + "'><a href='#" + $(this).text().toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '') + "'>" + $(this).text() + "</a></li>");
    $(this).attr("id", $(this).text().toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, ''));
  });
});
