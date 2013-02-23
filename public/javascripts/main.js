$(function() {
	
	
	if (getUrlVars()["stream"].lenth > 0)
	{
		updateStreamInfo();

		$(".flowplayer:first").bind("pause", function(e, api) {

		});
}






});

function updateStreamInfo()
{
	$.getJSON('sessions/'+getUrlVars()["stream"]+'.json', function(stream){
		document.stream = stream;
		setTimeout('updateStreamInfo()', 1000);
	});
}