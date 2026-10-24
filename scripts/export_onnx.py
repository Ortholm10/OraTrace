import argparse
import os
from pathlib import Path

import numpy as np
import onnxruntime as ort
import timm
import torch
import torch.nn as nn

ROOT = Path(__file__).resolve().parents[1]
NUM_CLASSES = 4


class WithCAM(nn.Module):
    def __init__(self, model):
        super().__init__()
        self.model = model
        self.classifier = model.get_classifier()
        if not hasattr(self.classifier, "weight"):
            raise TypeError("WithCAM requires a classifier with a weight tensor")

    def forward_features(self, x):
        return self.model.forward_features(x)

    def forward(self, x):
        features = self.forward_features(x)
        logits = self.classifier(features)
        weight = self.classifier.weight
        cam = torch.einsum("bchw,kc->bkhw", torch.relu(features), weight)
        return logits, cam


def validate_output_shapes(logits, cam):
    assert tuple(logits.shape) == (1, NUM_CLASSES), f"unexpected logits shape: {tuple(logits.shape)}"
    assert tuple(cam.shape) == (1, NUM_CLASSES, 7, 7), f"unexpected cam shape: {tuple(cam.shape)}"


def softmax_numpy(values):
    shifted = values - values.max(axis=1, keepdims=True)
    exponentials = np.exp(shifted)
    return exponentials / exponentials.sum(axis=1, keepdims=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ckpt", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    checkpoint_path = Path(args.ckpt).expanduser().resolve()
    output_path = Path(args.out).expanduser().resolve()
    if not checkpoint_path.is_file():
        raise SystemExit(f"checkpoint does not exist: {checkpoint_path}")

    device = torch.device("cpu")
    checkpoint = torch.load(checkpoint_path, map_location=device)
    if "model" not in checkpoint or "arch" not in checkpoint:
        raise SystemExit("checkpoint must contain model and arch")
    arch = str(checkpoint["arch"])

    model = timm.create_model(arch, pretrained=False, num_classes=NUM_CLASSES).to(device)
    model.load_state_dict(checkpoint["model"], strict=True)
    model.eval()
    plain = timm.create_model(arch, pretrained=False, num_classes=NUM_CLASSES).to(device)
    plain.load_state_dict(checkpoint["model"], strict=True)
    plain.eval()
    wrapped = WithCAM(model).to(device).eval()

    generator = torch.Generator(device="cpu").manual_seed(42)
    sample = torch.randn((1, 3, 224, 224), generator=generator, dtype=torch.float32)
    with torch.no_grad():
        plain_logits = plain(sample)
        expected_logits, expected_cam = wrapped(sample)
    validate_output_shapes(expected_logits, expected_cam)
    assert torch.allclose(expected_logits, plain_logits, atol=1e-6, rtol=1e-5), "WithCAM changes plain-model logits"

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with torch.no_grad():
        torch.onnx.export(
            wrapped,
            sample,
            str(output_path),
            input_names=["input"],
            output_names=["logits", "cam"],
            opset_version=17,
        )

    session_options = ort.SessionOptions()
    session_options.log_severity_level = 3
    session = ort.InferenceSession(
        str(output_path),
        sess_options=session_options,
        providers=["CPUExecutionProvider"],
    )
    assert session.get_inputs()[0].name == "input"
    assert [output.name for output in session.get_outputs()] == ["logits", "cam"]
    onnx_logits, onnx_cam = session.run(
        ["logits", "cam"],
        {"input": sample.numpy().astype(np.float32)},
    )
    validate_output_shapes(
        torch.from_numpy(onnx_logits),
        torch.from_numpy(onnx_cam),
    )
    np.testing.assert_allclose(onnx_logits, expected_logits.numpy(), rtol=1e-3, atol=1e-4)
    np.testing.assert_allclose(onnx_cam, expected_cam.numpy(), rtol=1e-3, atol=1e-4)
    np.testing.assert_allclose(
        softmax_numpy(onnx_logits),
        softmax_numpy(expected_logits.numpy()),
        rtol=1e-4,
        atol=1e-5,
    )
    print(f"exported -> {output_path}")
    print(
        f"arch={arch} logits_shape={onnx_logits.shape} cam_shape={onnx_cam.shape} "
        f"max_logit_diff={float(np.max(np.abs(onnx_logits - expected_logits.numpy()))):.3e}"
    )


if __name__ == "__main__":
    main()
