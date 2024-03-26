import * as tf from '@tensorflow/tfjs';
import React from 'react';
import '@tensorflow/tfjs-react-native';
export function useTensorFlowModel(modelKind: any) {
  const [model, setModel] = React.useState(null);
  // console.log("check modelkind", modelKind);

  const isMounted = React.useRef(true);

  React.useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);
  const getPosenet = React.useCallback(async () => {
    await tf.ready();
    const net = await modelKind.load();
    setModel(net);
  }, [modelKind]);
  React.useEffect(() => {
    setModel(null);
    getPosenet();
  }, [modelKind, getPosenet]);
  return model;
}

// export function useTensorFlowLoaded() {
//   const [isLoaded, setLoaded] = React.useState(false);

//   React.useEffect(() => {
//     let isMounted = true;
//     tf.ready()
//       .then(() => {
//         if (isMounted) {
//           setLoaded(true);
//         }
//       })
//       .catch(err => {
//         console.log(err);
//       });
//     return () => {
//       isMounted = false;
//     };
//   }, []);

//   return isLoaded;
// }
