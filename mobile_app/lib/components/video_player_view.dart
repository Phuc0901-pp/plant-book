import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

class VideoPlayerWebviewPage extends StatefulWidget {
  final String videoUrl;
  const VideoPlayerWebviewPage({super.key, required this.videoUrl});

  @override
  State<VideoPlayerWebviewPage> createState() => _VideoPlayerWebviewPageState();
}

class _VideoPlayerWebviewPageState extends State<VideoPlayerWebviewPage> {
  late final WebViewController _controller;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.black)
      ..loadHtmlString('''
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { margin: 0; background: black; display: flex; justify-content: center; align-items: center; height: 100vh; overflow: hidden; }
            video { width: 100vw; height: 100vh; object-fit: contain; }
          </style>
        </head>
        <body>
          <video controls autoplay playsinline name="media">
            <source src="${widget.videoUrl}" type="video/mp4">
            Trình duyệt không hỗ trợ xem video này.
          </video>
        </body>
        </html>
      ''');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        elevation: 0,
        title: const Text('Xem Video Canh Tác'),
      ),
      body: WebViewWidget(controller: _controller),
    );
  }
}
