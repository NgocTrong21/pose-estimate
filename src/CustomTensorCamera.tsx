import {cameraWithTensors} from '@tensorflow/tfjs-react-native';
import {Camera, CameraType} from 'expo-camera';
import React from 'react';
import {useTensorFlowModel} from './useTensorFlow';
import * as posenet from '@tensorflow-models/posenet';
import {Tensor3D} from '@tensorflow/tfjs';
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
// const TEXTURE_SIZE = {width: 1080, height: 1920};

// const TENSOR_WIDTH = 152;

// const CAMERA_RATIO = TEXTURE_SIZE.height / TEXTURE_SIZE.width;

// const TENSOR_SIZE = {
//   width: TENSOR_WIDTH,
//   height: TENSOR_WIDTH * CAMERA_RATIO,
// };
const IS_ANDROID = Platform.OS === 'android';
const IS_IOS = Platform.OS === 'ios';
const CAM_PREVIEW_WIDTH = Dimensions.get('window').width;
const CAM_PREVIEW_HEIGHT = CAM_PREVIEW_WIDTH / (IS_IOS ? 9 / 16 : 3 / 4);

// The score threshold for pose detection results.
const MIN_KEYPOINT_SCORE = 0.5;

// The size of the resized output from TensorCamera.
//
// For movenet, the size here doesn't matter too much because the model will
// preprocess the input (crop, resize, etc). For best result, use the size that
// doesn't distort the image.
const OUTPUT_TENSOR_WIDTH = 180;
const OUTPUT_TENSOR_HEIGHT = OUTPUT_TENSOR_WIDTH / (IS_IOS ? 9 / 16 : 3 / 4);
const TensorCamera = cameraWithTensors(Camera);

export function CustomTensorCamera({style, ...props}: {style: any}) {
  const displayTensor = React.useRef();
  const [pose3s, setPose3s] = React.useState<any>([]);
  const [orientation, setOrientation] =
    React.useState<ScreenOrientation.Orientation>();
  const [fps, setFps] = React.useState(0);
  const model = useTensorFlowModel(posenet);
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
  const [predictions, setPredictions] = React.useState([]);
  //
  React.useEffect(() => {
    const prepare = async () => {
      // rafId.current = null;

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
  // console.log('abchghg');

  const onReady = React.useCallback(
    (images: IterableIterator<Tensor3D>) => {
      const loop = async () => {
        if (model) {
          // console.log('check imgaes', images.next());
          const nextImageTensor = images.next().value;
          const startTs = performance.now();
          const imageScaleFactor = 0.5;
          const flipHorizontal = false;
          const outputStride = 16;
          // const imageElement = displayTensor.current
          try {
            const predictions = await (model as any).estimateSinglePose(
              nextImageTensor,
              {
                // imageElement,
                flipHorizontal,
                outputStride,
                imageScaleFactor,
              },
            );
            console.log('check predicts', JSON.stringify(predictions));

            const adjacentKeyPoints = posenet.getAdjacentKeyPoints(
              predictions.keypoints,
              MIN_KEYPOINT_SCORE,
            );
            const latency = performance.now() - startTs;
            setFps(Math.floor(1000 / latency));
            setPose3s(adjacentKeyPoints);
            setPredictions(predictions.keypoints);
          } catch (error) {
            console.log(error);
          }
        }
        requestAnimationFrame(loop);
      };
      loop();
    },
    [setPredictions, model],
  );
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
    if (
      predictions != null &&
      predictions.length > 0 &&
      pose3s != null &&
      pose3s.length > 0
    ) {
      const dotKeypoints = predictions
        .filter((k: any) => (k.score ?? 0) > MIN_KEYPOINT_SCORE)
        .map((k: any) => {
          // Flip horizontally on android or when using back camera on iOS.
          const flipX = IS_ANDROID || cameraType === Camera.Constants.Type.back;
          const x = flipX
            ? getOutputTensorWidth() - k.position.x
            : k.position.x;
          const y = k.position.y;
          const cx =
            (x / getOutputTensorWidth()) *
            (isPortrait() ? CAM_PREVIEW_WIDTH : CAM_PREVIEW_HEIGHT);
          const cy =
            (y / getOutputTensorHeight()) *
            (isPortrait() ? CAM_PREVIEW_HEIGHT : CAM_PREVIEW_WIDTH);
          return (
            <Circle
              key={`skeletonkp_${k.part}`}
              cx={cx}
              cy={cy}
              r="4"
              strokeWidth="2"
              fill="#00AA00"
              stroke="white"
            />
          );
        });

      const lineKeypoints = pose3s
        // .filter(
        //   (k: any) =>
        //     (k.firstItem.score ?? 0) > MIN_KEYPOINT_SCORE &&
        //     (k.secondItem.score ?? 0) > MIN_KEYPOINT_SCORE
        // )
        .map((k: any, index: any) => {
          // Flip horizontally on android or when using back camera on iOS.
          const flipX = IS_ANDROID || cameraType === Camera.Constants.Type.back;
          const x1 = flipX
            ? getOutputTensorWidth() - k[0].position.x
            : k[0].position.x;
          const y1 = k[0].position.y;
          const cx1 =
            (x1 / getOutputTensorWidth()) *
            (isPortrait() ? CAM_PREVIEW_WIDTH : CAM_PREVIEW_HEIGHT);
          const cy1 =
            (y1 / getOutputTensorHeight()) *
            (isPortrait() ? CAM_PREVIEW_HEIGHT : CAM_PREVIEW_WIDTH);
          const x2 = flipX
            ? getOutputTensorWidth() - k[1].position.x
            : k[1].position.x;
          const y2 = k[1].position.y;
          const cx2 =
            (x2 / getOutputTensorWidth()) *
            (isPortrait() ? CAM_PREVIEW_WIDTH : CAM_PREVIEW_HEIGHT);
          const cy2 =
            (y2 / getOutputTensorHeight()) *
            (isPortrait() ? CAM_PREVIEW_HEIGHT : CAM_PREVIEW_WIDTH);
          return (
            <Line
              key={`skeletonkp_${index}`}
              x1={cx1}
              y1={cy1}
              x2={cx2}
              y2={cy2}
              stroke="red"
              strokeWidth="2"
            />
          );
        });

      return (
        <Svg style={styles.svg}>
          {dotKeypoints}
          {lineKeypoints}
        </Svg>
      );
    } else {
      return <View></View>;
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
        {...(props as any)}
        style={style}
        resizeWidth={getOutputTensorWidth()}
        resizeHeight={getOutputTensorHeight()}
        onReady={onReady}
        autorender={true}
        type={cameraType}
        resizeDepth={3}
      />
      {renderFps()}
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
});
