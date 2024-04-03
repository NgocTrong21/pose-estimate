import * as poseDetection from '@tensorflow-models/pose-detection';
import * as tf from '@tensorflow/tfjs-core';
// Register one of the TF.js backends.
import '@tensorflow/tfjs-backend-webgl';
import React from 'react';
export function useModelMovenet() {
  const [model, setModel] = React.useState<poseDetection.PoseDetector>();
  const isMounted = React.useRef(true);
  React.useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);
  const getMovenet = React.useCallback(async () => {
    await tf.ready();
    console.log(tf.getBackend());

    const detectorConfig = {
      modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
    };
    const detector = await poseDetection.createDetector(
      poseDetection.SupportedModels.MoveNet,
      detectorConfig,
    );

    setModel(detector);
  }, []);
  React.useEffect(() => {
    setModel(undefined);
    getMovenet();
  }, [getMovenet]);
  return model;
}
