import {cameraWithTensors} from '@tensorflow/tfjs-react-native';
import {Camera, CameraType} from 'expo-camera';
import React from 'react';
import * as tf from '@tensorflow/tfjs-core';
import * as posedetection from '@tensorflow-models/pose-detection';
import {LoadingView} from './LoadingView';
import {
  Dimensions,
  Platform,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Svg, {Circle, Line} from 'react-native-svg';
import * as ScreenOrientation from 'expo-screen-orientation';
import {useModelMovenet} from './useModelMovenet';
import {ExpoWebGLRenderingContext} from 'expo-gl';
// tslint:disable-next-line: variable-name
const TensorCamera = cameraWithTensors(Camera);

const IS_ANDROID = Platform.OS === 'android';
const IS_IOS = Platform.OS === 'ios';

// Camera preview size.
//
// From experiments, to render camera feed without distortion, 16:9 ratio
// should be used fo iOS devices and 4:3 ratio should be used for android
// devices.
//
// This might not cover all cases.
const CAM_PREVIEW_WIDTH = Dimensions.get('window').width;
const CAM_PREVIEW_HEIGHT = CAM_PREVIEW_WIDTH / (IS_IOS ? 9 / 16 : 3 / 4);

// The score threshold for pose detection results.
const MIN_KEYPOINT_SCORE = 0.3;

// The size of the resized output from TensorCamera.
//
// For movenet, the size here doesn't matter too much because the model will
// preprocess the input (crop, resize, etc). For best result, use the size that
// doesn't distort the image.
const OUTPUT_TENSOR_WIDTH = 256;
const OUTPUT_TENSOR_HEIGHT = 256;

// Whether to auto-render TensorCamera preview.
const AUTO_RENDER = true;

// Whether to load model from app bundle (true) or through network (false).
// const LOAD_MODEL_FROM_BUNDLE = false;
const lines = [
  // left shoulder -> elbow
  [5, 7],
  // right shoulder -> elbow
  [6, 8],
  // left elbow -> wrist
  [7, 9],
  // right elbow -> wrist
  [8, 10],
  // left hip -> knee
  [11, 13],
  // right hip -> knee
  [12, 14],
  // left knee -> ankle
  [13, 15],
  // right knee -> ankle
  [14, 16],
  // left hip -> right hip
  [11, 12],
  // left shoulder -> right shoulder
  [5, 6],
  // left shoulder -> left hip
  [5, 11],
  // right shoulder -> right hip
  [6, 12],
];
export function CameraMovenet() {
  const cameraRef = React.useRef(null);
  const rafId = React.useRef<number | null>(null);
  const [poses, setPoses] = React.useState<posedetection.Pose[]>();
  const displayTensor = React.useRef();
  const [orientation, setOrientation] =
    React.useState<ScreenOrientation.Orientation>();
  const [fps, setFps] = React.useState(0);
  const model = useModelMovenet();
  const [cameraType, setCameraType] = React.useState<CameraType>(
    Camera.Constants.Type.front,
  );
  const handleSwitchCameraType = () => {
    if (cameraType === Camera.Constants.Type.front) {
      setCameraType(Camera.Constants.Type.back);
    } else {
      setCameraType(Camera.Constants.Type.front);
    }
  };
  const renderCameraTypeSwitcher = () => {
    return (
      <TouchableOpacity
        onPress={handleSwitchCameraType}
        style={styles.switchCamera}>
        <Text>
          Switch to{' '}
          {cameraType === Camera.Constants.Type.front ? 'back' : 'front'} camera
        </Text>
      </TouchableOpacity>
    );
  };
  React.useEffect(() => {
    const prepare = async () => {
      rafId.current = null;

      // Set initial orientation.
      const curOrientation = await ScreenOrientation.getOrientationAsync();
      setOrientation(curOrientation);

      // Listens to orientation change.
      ScreenOrientation.addOrientationChangeListener(event => {
        setOrientation(event.orientationInfo.orientation);
      });
    };
    prepare();
  }, []);

  const isPortrait = () => {
    return (
      orientation === ScreenOrientation.Orientation.PORTRAIT_UP ||
      orientation === ScreenOrientation.Orientation.PORTRAIT_DOWN
    );
  };

  const handleCameraStream = async (
    images: IterableIterator<tf.Tensor3D>,
    updatePreview: () => void,
    gl: ExpoWebGLRenderingContext,
  ) => {
    const loop = async () => {
      // Get the tensor and run pose detection.
      const imageTensor = images.next().value as tf.Tensor3D;
      const startTs = performance.now();

      const posesData = await model!.estimatePoses(
        imageTensor,
        {
          maxPoses: 1,
        },
        Date.now(),
      );
      const latency = performance.now() - startTs;
      setFps(Math.floor(1000 / latency));
      setPoses(posesData);
      tf.dispose([imageTensor]);

      if (rafId.current === 0) {
        return;
      }

      // Render camera preview manually when autorender=false.
      if (!AUTO_RENDER) {
        updatePreview();
        gl.endFrameEXP();
      }

      rafId.current = requestAnimationFrame(loop);
    };

    loop();
  };
  const getOutputTensorWidth = () => {
    // On iOS landscape mode, switch width and height of the output tensor to
    // get better result. Without this, the image stored in the output tensor
    // would be stretched too much.
    //
    // Same for getOutputTensorHeight below.
    return isPortrait() || IS_ANDROID
      ? OUTPUT_TENSOR_WIDTH
      : OUTPUT_TENSOR_HEIGHT;
  };
  const getTextureRotationAngleInDegrees = () => {
    // On Android, the camera texture will rotate behind the scene as the phone
    // changes orientation, so we don't need to rotate it in TensorCamera.
    if (IS_ANDROID) {
      return 0;
    }

    // For iOS, the camera texture won't rotate automatically. Calculate the
    // rotation angles here which will be passed to TensorCamera to rotate it
    // internally.
    switch (orientation) {
      // Not supported on iOS as of 11/2021, but add it here just in case.
      case ScreenOrientation.Orientation.PORTRAIT_DOWN:
        return 180;
      case ScreenOrientation.Orientation.LANDSCAPE_LEFT:
        return cameraType === Camera.Constants.Type.front ? 270 : 90;
      case ScreenOrientation.Orientation.LANDSCAPE_RIGHT:
        return cameraType === Camera.Constants.Type.front ? 90 : 270;
      default:
        return 0;
    }
  };
  const getOutputTensorHeight = () => {
    return isPortrait() || IS_ANDROID
      ? OUTPUT_TENSOR_HEIGHT
      : OUTPUT_TENSOR_WIDTH;
  };
  const renderFps = () => {
    return (
      <View style={styles.fpsContainer}>
        <Text>FPS: {fps}</Text>
      </View>
    );
  };
  const renderPose = () => {
    if (poses != null && poses.length > 0) {
      const posesData = poses[0].keypoints;
      const filterData = poses[0].keypoints.filter(
        k => (k.score ?? 0) > MIN_KEYPOINT_SCORE,
      );
      const keypoints = filterData.map(k => {
        // Flip horizontally on android or when using back camera on iOS.
        const flipX = IS_ANDROID || cameraType === Camera.Constants.Type.back;
        const x = flipX ? getOutputTensorWidth() - k.x : k.x;
        const y = k.y;
        const cx =
          (x / getOutputTensorWidth()) *
          (isPortrait() ? CAM_PREVIEW_WIDTH : CAM_PREVIEW_HEIGHT);
        const cy =
          (y / getOutputTensorHeight()) *
          (isPortrait() ? CAM_PREVIEW_HEIGHT : CAM_PREVIEW_WIDTH);
        return (
          <Circle
            key={`skeletonkp_${k.name}`}
            cx={cx}
            cy={cy}
            r="4"
            strokeWidth="2"
            fill="#00AA00"
            stroke="white"
          />
        );
      });
      const keyPointLines = lines.map((item, index) => {
        if (
          posesData[item[0]].score > MIN_KEYPOINT_SCORE ||
          posesData[item[1]].score > MIN_KEYPOINT_SCORE
        ) {
          // Flip horizontally on android or when using back camera on iOS.
          const flipX = IS_ANDROID || cameraType === Camera.Constants.Type.back;
          const x1 = flipX
            ? getOutputTensorWidth() - posesData[item[0]].x
            : posesData[item[0]].x;
          const y1 = posesData[item[0]].y;
          const cx1 =
            (x1 / getOutputTensorWidth()) *
            (isPortrait() ? CAM_PREVIEW_WIDTH : CAM_PREVIEW_HEIGHT);
          const cy1 =
            (y1 / getOutputTensorHeight()) *
            (isPortrait() ? CAM_PREVIEW_HEIGHT : CAM_PREVIEW_WIDTH);
          const x2 = flipX
            ? getOutputTensorWidth() - posesData[item[1]].x
            : posesData[item[1]].x;
          const y2 = posesData[item[1]].y;
          const cx2 =
            (x2 / getOutputTensorWidth()) *
            (isPortrait() ? CAM_PREVIEW_WIDTH : CAM_PREVIEW_HEIGHT);
          const cy2 =
            (y2 / getOutputTensorHeight()) *
            (isPortrait() ? CAM_PREVIEW_HEIGHT : CAM_PREVIEW_WIDTH);

          return (
            <Line
              key={`line-${index}`}
              stroke="red"
              strokeWidth="2"
              x1={cx1}
              y1={cy1}
              x2={cx2}
              y2={cy2}
            />
          );
        }
      });
      return (
        <Svg style={styles.svg}>
          {keypoints}
          {keyPointLines}
        </Svg>
      );
    } else {
      return <View />;
    }
  };

  if (!model) {
    return <LoadingView>Loading TensorFlow model</LoadingView>;
  }
  return (
    <View
      ref={displayTensor as any}
      style={
        isPortrait() ? styles.containerPortrait : styles.containerLandscape
      }>
      <TensorCamera
        ref={cameraRef}
        style={styles.camera}
        autorender={AUTO_RENDER}
        type={cameraType}
        // tensor related props
        resizeWidth={getOutputTensorWidth()}
        resizeHeight={getOutputTensorHeight()}
        resizeDepth={3}
        rotation={getTextureRotationAngleInDegrees()}
        onReady={handleCameraStream}
      />
      {/* {renderFps()} */}
      {renderPose()}
      {renderCameraTypeSwitcher()}
    </View>
  );
}

const styles = StyleSheet.create({
  containerPortrait: {
    position: 'relative',
    width: CAM_PREVIEW_WIDTH,
    height: CAM_PREVIEW_HEIGHT,
    marginTop: Dimensions.get('window').height / 2 - CAM_PREVIEW_HEIGHT / 2,
  },
  containerLandscape: {
    position: 'relative',
    width: CAM_PREVIEW_HEIGHT,
    height: CAM_PREVIEW_WIDTH,
    marginLeft: Dimensions.get('window').height / 2 - CAM_PREVIEW_HEIGHT / 2,
  },
  svg: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    zIndex: 30,
  },
  fpsContainer: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 80,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, .7)',
    borderRadius: 2,
    padding: 8,
    zIndex: 20,
  },
  switchCamera: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 180,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, .7)',
    borderRadius: 2,
    padding: 8,
    zIndex: 80,
  },
  camera: {
    width: '100%',
    height: '100%',
    zIndex: 1,
  },
});
