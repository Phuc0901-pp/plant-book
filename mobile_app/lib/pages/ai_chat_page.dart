import 'package:flutter/material.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import '../core/state/app_state_and_concepts.dart';
import '../services/api_service.dart';
import '../utils/theme.dart';

class SimpleMarkdownText extends StatelessWidget {
  final String text;
  final TextStyle style;
  final Color? codeBackgroundColor;
  final Color? codeTextColor;

  const SimpleMarkdownText(
    this.text, {
    super.key,
    required this.style,
    this.codeBackgroundColor,
    this.codeTextColor,
  });

  static List<InlineSpan> parseInlineSpans(
    String line,
    TextStyle baseStyle, {
    Color? codeBg,
    Color? codeFg,
  }) {
    final List<InlineSpan> spans = <InlineSpan>[];
    final RegExp tokenPattern = RegExp(r'\*\*(.+?)\*\*|`([^`]+)`');
    int cursor = 0;

    for (final RegExpMatch match in tokenPattern.allMatches(line)) {
      if (match.start > cursor) {
        spans.add(
          TextSpan(text: line.substring(cursor, match.start), style: baseStyle),
        );
      }
      final String? boldText = match.group(1);
      final String? codeText = match.group(2);
      if (boldText != null) {
        spans.add(
          TextSpan(
            text: boldText,
            style: baseStyle.copyWith(fontWeight: FontWeight.w700),
          ),
        );
      } else if (codeText != null) {
        spans.add(
          TextSpan(
            text: ' $codeText ',
            style: baseStyle.copyWith(
              fontFamily: 'monospace',
              fontSize: (baseStyle.fontSize ?? 14) - 1,
              fontWeight: FontWeight.w600,
              color: codeFg ?? AppTheme.fluentEmeraldDark,
              backgroundColor: codeBg ?? const Color(0xFFECFDF5),
            ),
          ),
        );
      }
      cursor = match.end;
    }

    if (cursor < line.length) {
      spans.add(TextSpan(text: line.substring(cursor), style: baseStyle));
    }
    if (spans.isEmpty) {
      spans.add(TextSpan(text: line, style: baseStyle));
    }
    return spans;
  }

  @override
  Widget build(BuildContext context) {
    final List<String> lines = text.split('\n');
    final List<Widget> blocks = <Widget>[];

    for (int i = 0; i < lines.length; i++) {
      final String rawLine = lines[i];
      final String trimmed = rawLine.trimLeft();

      if (trimmed.isEmpty) {
        blocks.add(const SizedBox(height: 6));
        continue;
      }

      if (trimmed.startsWith('### ') ||
          trimmed.startsWith('## ') ||
          trimmed.startsWith('# ')) {
        final String headingText = trimmed.replaceFirst(RegExp(r'^#{1,3}\s+'), '');
        final TextStyle headingStyle = style.copyWith(
          fontSize: (style.fontSize ?? 14) + 1.5,
          fontWeight: FontWeight.w800,
        );
        blocks.add(
          Padding(
            padding: const EdgeInsets.only(top: 4, bottom: 2),
            child: Text.rich(
              TextSpan(
                children: parseInlineSpans(
                  headingText,
                  headingStyle,
                  codeBg: codeBackgroundColor,
                  codeFg: codeTextColor,
                ),
              ),
            ),
          ),
        );
        continue;
      }

      if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
        final String bulletBody = trimmed.substring(2).trimLeft();
        blocks.add(
          Padding(
            padding: const EdgeInsets.only(left: 4, top: 2, bottom: 2),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('• ', style: style.copyWith(fontWeight: FontWeight.bold)),
                Expanded(
                  child: Text.rich(
                    TextSpan(
                      children: parseInlineSpans(
                        bulletBody,
                        style,
                        codeBg: codeBackgroundColor,
                        codeFg: codeTextColor,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
        continue;
      }

      blocks.add(
        Text.rich(
          TextSpan(
            children: parseInlineSpans(
              rawLine,
              style,
              codeBg: codeBackgroundColor,
              codeFg: codeTextColor,
            ),
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: blocks,
    );
  }
}

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

  late stt.SpeechToText _speech;
  bool _isListening = false;

  List<String> get _quickSuggestions => AppConcepts.aiQuickSuggestions;

  @override
  void initState() {
    super.initState();
    _speech = stt.SpeechToText();

    _messages.add({
      'role': 'assistant',
      'text': AppConcepts.aiWelcomeMessage,
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

  List<Map<String, String>> _buildHistoryPayload() {
    final List<Map<String, dynamic>> prior = _messages.length <= AppConcepts.aiMaxHistoryMessages
        ? _messages
        : _messages.sublist(_messages.length - AppConcepts.aiMaxHistoryMessages);
    return prior
        .map((m) => <String, String>{
              'role': (m['role'] ?? 'assistant').toString(),
              'text': (m['text'] ?? '').toString(),
            })
        .toList();
  }

  Future<void> _sendMessage([String? customText]) async {
    final text = (customText ?? _controller.text).trim();
    if (text.isEmpty || _isLoading) return;

    final historyPayload = _buildHistoryPayload();

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
      final store = AppStateStore();
      final reply = await ApiService().sendAiChatMessage(
        text,
        history: historyPayload,
        activeFarmId: store.activeFarmId,
        activePlantId: store.activePlantId,
      );
      if (mounted) {
        setState(() {
          _messages.add({
            'role': 'assistant',
            'text': reply ??
                'Dạ Bé Mầm đang bận một chút, Bác vui lòng hỏi lại sau ít giây nhé!',
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
            'text':
                '⚠️ Không thể kết nối tới máy chủ AI. Bác vui lòng kiểm tra kết nối mạng nhé!',
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
            if (mounted) setState(() => _isListening = false);
          }
        },
        onError: (val) {
          if (mounted) setState(() => _isListening = false);
        },
      );
      if (available) {
        if (mounted) setState(() => _isListening = true);
        _speech.listen(
          localeId: 'vi_VN',
          onResult: (val) {
            if (mounted) {
              setState(() {
                _controller.text = val.recognizedWords;
              });
            }
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
                Text(
                  'Bé Mầm AI AgTech',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                Text(
                  'Trợ lý Nông nghiệp Thông minh',
                  style: TextStyle(fontSize: 11, color: Colors.white70),
                ),
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
                  'text':
                      '🌱 **Cuộc trò chuyện đã được làm mới.** Bác cần Bé Mầm hỗ trợ thông tin gì ạ?',
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
                    label: Text(
                      s,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    backgroundColor: Colors.white,
                    side: const BorderSide(
                      color: Color(0xFF10B981),
                      width: 0.8,
                    ),
                    onPressed: () => _sendMessage(s),
                  );
                },
              ),
            ),

            const Divider(height: 1, color: AppTheme.grayBorder),

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
                      mainAxisAlignment: isAssistant
                          ? MainAxisAlignment.start
                          : MainAxisAlignment.end,
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
                            padding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 10,
                            ),
                            decoration: BoxDecoration(
                              color: isAssistant ? Colors.white : AppTheme.greenDark,
                              borderRadius: BorderRadius.circular(16).copyWith(
                                topLeft: isAssistant
                                    ? const Radius.circular(4)
                                    : const Radius.circular(16),
                                topRight: !isAssistant
                                    ? const Radius.circular(4)
                                    : const Radius.circular(16),
                              ),
                              border: isAssistant
                                  ? Border.all(color: AppTheme.grayBorder)
                                  : null,
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withOpacity(0.04),
                                  blurRadius: 4,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: SimpleMarkdownText(
                              msg['text'] as String,
                              style: TextStyle(
                                fontSize: 14,
                                height: 1.45,
                                color: isAssistant
                                    ? AppTheme.textMain
                                    : Colors.white,
                              ),
                              codeBackgroundColor: isAssistant
                                  ? const Color(0xFFECFDF5)
                                  : const Color(0xFF064E3B),
                              codeTextColor: isAssistant
                                  ? AppTheme.fluentEmeraldDark
                                  : Colors.white,
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
                            child: const Icon(
                              Icons.person,
                              size: 18,
                              color: AppTheme.userAccent,
                            ),
                          ),
                        ],
                      ],
                    ),
                  );
                },
              ),
            ),

            if (_isLoading)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                alignment: Alignment.centerLeft,
                child: Row(
                  children: [
                    const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppTheme.green,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      'Bé Mầm đang phân tích & tra cứu tài liệu...',
                      style: TextStyle(
                        fontSize: 12,
                        color: AppTheme.textMuted,
                        fontStyle: FontStyle.italic,
                      ),
                    ),
                  ],
                ),
              ),

            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: const BoxDecoration(
                color: Colors.white,
                border: Border(top: BorderSide(color: AppTheme.grayBorder)),
              ),
              child: Row(
                children: [
                  IconButton(
                    icon: Icon(
                      _isListening ? Icons.mic : Icons.mic_none,
                      color: _isListening ? Colors.red : AppTheme.green,
                    ),
                    tooltip: 'Đọc câu hỏi bằng giọng nói',
                    onPressed: _toggleListening,
                  ),

                  Expanded(
                    child: TextField(
                      key: const Key('ai_chat_input'),
                      controller: _controller,
                      minLines: 1,
                      maxLines: 4,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => _sendMessage(),
                      decoration: InputDecoration(
                        hintText: _isListening
                            ? 'Đang lắng nghe Bác nói...'
                            : 'Nhập câu hỏi hoặc kỹ thuật cần tư vấn...',
                        hintStyle: const TextStyle(
                          fontSize: 13,
                          color: AppTheme.textMuted,
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 10,
                        ),
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

                  Container(
                    decoration: const BoxDecoration(
                      color: AppTheme.green,
                      shape: BoxShape.circle,
                    ),
                    child: IconButton(
                      key: const Key('ai_chat_send_button'),
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
