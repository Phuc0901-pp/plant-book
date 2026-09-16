import 'package:flutter/material.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import '../services/api_service.dart';
import '../utils/theme.dart';

class AiChatPage extends StatefulWidget {
  const AiChatPage({super.key});

  @override
  State<AiChatPage> createState() => _AiChatPageState();
}

class _AiChatPageState extends State<AiChatPage> {
  final TextEditingController _controller = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final List<Map<String, dynamic>> _messages = [];
  bool _isLoading = false;

  // Voice speech-to-text
  late stt.SpeechToText _speech;
  bool _isListening = false;

  final List<String> _quickSuggestions = [
    '🌱 Hướng dẫn sử dụng app',
    '🏡 Danh sách trang trại của tôi',
    '💰 Tổng chi phí vật tư đã dùng',
    '🌿 Cách xử lý vàng lá thối rễ',
    '💊 Thời gian cách ly thuốc BVTV',
    '📝 Nhật ký canh tác gần đây',
  ];

  @override
  void initState() {
    super.initState();
    _speech = stt.SpeechToText();

    // Initial greeting from Bé Mầm
    _messages.add({
      'role': 'assistant',
      'text': '🌱 **Chào Bác! Em là Bé Mầm - Trợ lý Nông nghiệp Thông minh.**\n\nBác cần tư vấn kỹ thuật canh tác sầu riêng, tra cứu liều lượng phân thuốc, quy trình VietGAP hay kiểm tra chi phí vườn hôm nay ạ? ✨',
      'time': DateTime.now(),
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _sendMessage([String? customText]) async {
    final text = (customText ?? _controller.text).trim();
    if (text.isEmpty || _isLoading) return;

    _controller.clear();
    setState(() {
      _messages.add({
        'role': 'user',
        'text': text,
        'time': DateTime.now(),
      });
      _isLoading = true;
    });
    _scrollToBottom();

    try {
      final reply = await ApiService().sendAiChatMessage(text);
      if (mounted) {
        setState(() {
          _messages.add({
            'role': 'assistant',
            'text': reply ?? 'Dạ Bé Mầm đang bận một chút, Bác vui lòng hỏi lại sau ít giây nhé!',
            'time': DateTime.now(),
          });
          _isLoading = false;
        });
        _scrollToBottom();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _messages.add({
            'role': 'assistant',
            'text': '⚠️ Không thể kết nối tới máy chủ AI. Bác vui lòng kiểm tra kết nối mạng nhé!',
            'time': DateTime.now(),
          });
          _isLoading = false;
        });
        _scrollToBottom();
      }
    }
  }

  void _toggleListening() async {
    if (!_isListening) {
      bool available = await _speech.initialize(
        onStatus: (val) {
          if (val == 'done' || val == 'notListening') {
            setState(() => _isListening = false);
          }
        },
        onError: (val) => setState(() => _isListening = false),
      );
      if (available) {
        setState(() => _isListening = true);
        _speech.listen(
          localeId: 'vi_VN',
          onResult: (val) {
            setState(() {
              _controller.text = val.recognizedWords;
            });
          },
        );
      }
    } else {
      setState(() => _isListening = false);
      _speech.stop();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: const BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
              ),
              child: const Center(
                child: Text('🌱', style: TextStyle(fontSize: 20)),
              ),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                Text('Bé Mầm AI AgTech', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                Text('Trợ lý Nông nghiệp Thông minh', style: TextStyle(fontSize: 11, color: Colors.white70)),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Làm mới cuộc trò chuyện',
            onPressed: () {
              setState(() {
                _messages.clear();
                _messages.add({
                  'role': 'assistant',
                  'text': '🌱 **Cuộc trò chuyện đã được làm mới.** Bác cần Bé Mầm hỗ trợ thông tin gì ạ?',
                  'time': DateTime.now(),
                });
              });
            },
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Quick suggestions carousel
            Container(
              height: 44,
              margin: const EdgeInsets.symmetric(vertical: 6),
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                scrollDirection: Axis.horizontal,
                itemCount: _quickSuggestions.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final s = _quickSuggestions[index];
                  return ActionChip(
                    label: Text(s, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
                    backgroundColor: Colors.white,
                    side: const BorderSide(color: Color(0xFF10B981), width: 0.8),
                    onPressed: () => _sendMessage(s),
                  );
                },
              ),
            ),

            const Divider(height: 1, color: AppTheme.grayBorder),

            // Chat Messages List
            Expanded(
              child: ListView.builder(
                controller: _scrollController,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                itemCount: _messages.length,
                itemBuilder: (context, index) {
                  final msg = _messages[index];
                  final isAssistant = msg['role'] == 'assistant';

                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: isAssistant ? MainAxisAlignment.start : MainAxisAlignment.end,
                      children: [
                        if (isAssistant) ...[
                          Container(
                            width: 32,
                            height: 32,
                            margin: const EdgeInsets.only(right: 8, top: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFFECFDF5),
                              shape: BoxShape.circle,
                              border: Border.all(color: const Color(0xFF10B981)),
                            ),
                            child: const Center(
                              child: Text('🌱', style: TextStyle(fontSize: 16)),
                            ),
                          ),
                        ],
                        Flexible(
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                            decoration: BoxDecoration(
                              color: isAssistant ? Colors.white : AppTheme.greenDark,
                              borderRadius: BorderRadius.circular(16).copyWith(
                                topLeft: isAssistant ? const Radius.circular(4) : const Radius.circular(16),
                                topRight: !isAssistant ? const Radius.circular(4) : const Radius.circular(16),
                              ),
                              border: isAssistant ? Border.all(color: AppTheme.grayBorder) : null,
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withOpacity(0.04),
                                  blurRadius: 4,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: SelectableText(
                              msg['text'] as String,
                              style: TextStyle(
                                fontSize: 14,
                                height: 1.45,
                                color: isAssistant ? AppTheme.textMain : Colors.white,
                              ),
                            ),
                          ),
                        ),
                        if (!isAssistant) ...[
                          Container(
                            width: 32,
                            height: 32,
                            margin: const EdgeInsets.only(left: 8, top: 2),
                            decoration: const BoxDecoration(
                              color: AppTheme.userAccentSoft,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.person, size: 18, color: AppTheme.userAccent),
                          ),
                        ],
                      ],
                    ),
                  );
                },
              ),
            ),

            // Typing indicator
            if (_isLoading)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                alignment: Alignment.centerLeft,
                child: Row(
                  children: [
                    const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.green),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      'Bé Mầm đang phân tích & tra cứu tài liệu...',
                      style: TextStyle(fontSize: 12, color: AppTheme.textMuted, fontStyle: FontStyle.italic),
                    ),
                  ],
                ),
              ),

            // Input Bar
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: const BoxDecoration(
                color: Colors.white,
                border: Border(top: BorderSide(color: AppTheme.grayBorder)),
              ),
              child: Row(
                children: [
                  // Voice Mic Button
                  IconButton(
                    icon: Icon(
                      _isListening ? Icons.mic : Icons.mic_none,
                      color: _isListening ? Colors.red : AppTheme.green,
                    ),
                    tooltip: 'Đọc câu hỏi bằng giọng nói',
                    onPressed: _toggleListening,
                  ),

                  // Text input
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      minLines: 1,
                      maxLines: 4,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => _sendMessage(),
                      decoration: InputDecoration(
                        hintText: _isListening ? 'Đang lắng nghe Bác nói...' : 'Nhập câu hỏi hoặc kỹ thuật cần tư vấn...',
                        hintStyle: const TextStyle(fontSize: 13, color: AppTheme.textMuted),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        filled: true,
                        fillColor: const Color(0xFFF1F5F9),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(24),
                          borderSide: BorderSide.none,
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(width: 6),

                  // Send button
                  Container(
                    decoration: const BoxDecoration(
                      color: AppTheme.green,
                      shape: BoxShape.circle,
                    ),
                    child: IconButton(
                      icon: const Icon(Icons.send, color: Colors.white, size: 18),
                      onPressed: () => _sendMessage(),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
