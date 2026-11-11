"""不装 PyTorch 也能用 mlx-vlm 训练 Qwen3.5 的“看图识别”：

transformers 的 Qwen3VLProcessor 会连带创建视频处理器（Qwen3VLVideoProcessor），它要求 PyTorch 和 torchvision。
我们只用图片：这里组装一个只有“图片处理器 + 分词器”的处理器。图片处理器用 Qwen2VLImageProcessorPil（PIL + numpy，
参数来自同一份 preprocessor_config.json），再替换 mlx_vlm.utils.load_processor。
"""
from transformers import AutoTokenizer, Qwen2VLImageProcessorPil
from transformers.models.qwen3_vl.processing_qwen3_vl import Qwen3VLProcessor
from transformers.processing_utils import ProcessorMixin


class ImageOnlyQwen3VLProcessor(Qwen3VLProcessor):
    def __init__(self, image_processor=None, tokenizer=None, chat_template=None, **kwargs):
        self.image_token = getattr(tokenizer, "image_token", None) or "<|image_pad|>"
        self.video_token = getattr(tokenizer, "video_token", None) or "<|video_pad|>"
        self.image_token_id = getattr(tokenizer, "image_token_id", None) or tokenizer.convert_tokens_to_ids(self.image_token)
        self.video_token_id = getattr(tokenizer, "video_token_id", None) or tokenizer.convert_tokens_to_ids(self.video_token)
        self.image_processor = image_processor
        self.tokenizer = tokenizer
        self.video_processor = None
        self.chat_template = chat_template
        self.vision_start_token = getattr(tokenizer, "vision_start_token", None) or "<|vision_start|>"
        self.vision_end_token = getattr(tokenizer, "vision_end_token", None) or "<|vision_end|>"
        self.vision_start_token_id = getattr(tokenizer, "vision_start_token_id", None) or tokenizer.convert_tokens_to_ids(self.vision_start_token)
        self.vision_end_token_id = getattr(tokenizer, "vision_end_token_id", None) or tokenizer.convert_tokens_to_ids(self.vision_end_token)


def load_image_only(path, **kwargs):
    tok = AutoTokenizer.from_pretrained(path)
    ip = Qwen2VLImageProcessorPil.from_pretrained(path)
    return ImageOnlyQwen3VLProcessor(image_processor=ip, tokenizer=tok, chat_template=tok.chat_template)


def install():
    """让 mlx_vlm 加载处理器时：缺 PyTorch 就改用只有图片的处理器（反分词器、停止条件等仍由 mlx_vlm 照常加上）"""
    import mlx_vlm.utils as U
    from transformers import AutoProcessor

    class _Auto:
        @staticmethod
        def from_pretrained(path, **kwargs):
            try:
                return AutoProcessor.from_pretrained(path, **kwargs)
            except ImportError:
                return load_image_only(str(path))

    U.AutoProcessor = _Auto
    return U


__all__ = ["install", "load_image_only", "ImageOnlyQwen3VLProcessor", "ProcessorMixin"]
