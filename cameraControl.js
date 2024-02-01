window.addEventListener("DOMContentLoaded", init);

import * as THREE from 'three';
import { VRButton } from "three/addons/webxr/VRButton.js";
import WebXRPolyfill from "webxr-polyfill";
import { XRControllerModelFactory } from 'https://unpkg.com/three@0.150.1/examples/jsm/webxr/XRControllerModelFactory.js';
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

//ファイル名宣言
const fileName = "bio-CE-CX300.csv";

//データの座標範囲の上限と下限の設定
let max = 1;
let min = -max;

//削除回数
let deleteTimes = 15;

// ノード座標を保持する配列
let nodePositions = [];
let networkData;

//ノードの離す大きさ
const coefficient = 10;

//半径
let radius = 0.2;

//自動設定
//範囲
const autoRangeSetting = true; //true:データの数に応じて範囲を設定　false:グローバル変数を参照
//削除回数
const autodeleteSetting = true; //true:データの数に応じて削除回数を設定　false:グローバル変数を参照
//半径
const autoRadius = true; //true:データの数に応じてnodeの半径を設定　false:グローバル変数を参照



function init() {
  /* --------------- 基本的な設定 ここから --------------- */
  // WebXRのポリフィルを有効にする
  const polyfill = new WebXRPolyfill();

  // サイズを指定
  const width = window.innerWidth;
  const height = window.innerHeight;

  // シーンの作成
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  // グループの準備
  const group = new THREE.Group();
  scene.add(group);

  // レンダラーの作成
  const renderer = new THREE.WebGLRenderer({
    antialias: true
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(width, height);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.xr.enabled = true; // レンダラーのXRを有効化
  document.body.appendChild(renderer.domElement);
  // WebVRの開始ボタンをDOMに追加
  document.body.appendChild(VRButton.createButton(renderer));

  // カメラを作成
  const camera = new THREE.PerspectiveCamera(90, width / height);
  // カメラの初期位置を設定
  camera.position.z = 10;

  // カメラ用コンテナを作成(3Dのカメラ？)
  const cameraContainer = new THREE.Object3D();
  cameraContainer.add(camera);
  scene.add(cameraContainer);
  cameraContainer.position.x = 0;
  
  
  /* --------------- 基本的な設定 ここまで --------------- */



  /* --------------- OrbitControls(マウスで動かせる設定)ここから --------------- */
  // OrbitControlsの作成
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; // ダンピングまたは自動回転が有効な場合、アニメーションループが必要です
  controls.dampingFactor = 0.25;
  controls.screenSpacePanning = false;
  controls.maxPolarAngle = Math.PI / 2;
  // VRモードのフラグ
  let inVRMode = false;
  // VRButtonのイベントリスナーを使用してVRモードの開始と終了を検知
  VRButton.createButton(renderer).addEventListener('selectstart', function () {
    // VRモードが開始された時の処理
    inVRMode = true;
    controls.enabled = false; // OrbitControlsを無効にする
  });

  VRButton.createButton(renderer).addEventListener('selectend', function () {
    // VRモードが終了した時の処理
    inVRMode = false;
    controls.enabled = true; // OrbitControlsを有効にする
  });
  /* --------------- OrbitControls(マウスで動かせる設定)ここまで --------------- */
  


  /* --------------- 光源設定 ここから --------------- */
  // 光源を作成
  createLights(scene);

  // 光源を作成する関数
  function createLights(scene) {
    const ambientLight = new THREE.AmbientLight(0x333333);
    scene.add(ambientLight);

    //光源を作成
    const light = new THREE.DirectionalLight(0xffffff, 0.5);
    light.position.set(0, 10, 100);
    scene.add(light);
  }
  /* --------------- 光源設定 ここまで --------------- */



  /* -------------------コントローラー設定 ここから------------------- */
  // コントローラーイベントの設定    squeeze button
  function onSelectEnd() {
    this.userData.isSelecting = false;
  }

  // コントローラーファクトリーの準備
  const controllerModelFactory = new XRControllerModelFactory();

  // コントローラーの光線の準備
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -1),
  ]);
  const material= new THREE.LineBasicMaterial({color: 0xff0000});
  const line = new THREE.Line(geometry , material);
  line.name = "line";
  line.scale.z = 5;

  // コントローラーの追加
  function addController(index) {
    // コントローラーの追加
    const controller = renderer.xr.getController(index);
    scene.add(controller);

    // コントローラーモデルの追加
    const controllerGrip = renderer.xr.getControllerGrip(index);
    controllerGrip.add(
      controllerModelFactory.createControllerModel(controllerGrip)
    );
    scene.add(controllerGrip);

    // コントローラーの光線の追加
    controller.add(line.clone());
    return controller;
  }

  // コントローラーの準備
  const controller0 = addController(0);
  const controller1 = addController(1);

  // コントローラーのイベントリスナーの追加
  controller0.addEventListener('selectstart', onSelectStart);
  controller0.addEventListener('selectend', onSelectEnd);
  controller1.addEventListener('selectstart', onSelectStart);
  controller1.addEventListener('selectend', onSelectEnd);

  // トリガーを押した時に呼ばれる
  function onSelectStart(event) {
    const controller = event.target;
    // レイと交差しているシェイプの取得
    const intersections = getIntersections(controller);
    // シェイプをコントローラにアタッチし、シェイプを青くする
    if (intersections.length > 0) {
      const intersection = intersections[0];
      const object = intersection.object;

      // 動かす前の座標を保存
      const originalPosition = { x: object.position.x, y: object.position.y, z: object.position.z };

      // シェイプを青く光らせる
      object.material.emissive.b = 1;

      // オブジェクトの座標をコントローラーにアタッチ
      controller.attach(object);

      // コントローラーのユーザーデータに選択されたオブジェクトを保存
      controller.userData.selected = object;

      // オブジェクトが動かされたときの処理
      controller.addEventListener('selectend', () => {
       // nodePositionsに動く前の座標と同じものがあれば、動いた後の座標に変更する
        const matchingIndex = nodePositions.findIndex(node => (
          node.x === originalPosition.x && node.y === originalPosition.y && node.z === originalPosition.z
        ));
        if (matchingIndex !== -1) {
          // オブジェクトの座標を更新
          nodePositions[matchingIndex] = object.position;
        }
        //ノードとエッジを消す
        clearScene();
        //変更されたノードの位置を再描画
        renderNetwork(networkData, group, camera, renderer, nodePositions);
      });
    }
  }

  // トリガーを離した時に呼ばれる
  function onSelectEnd(event) {
    const controller = event.target;

    // シェイプをグループにアタッチし、シェイプの色を戻す
    if (controller.userData.selected !== undefined) {
      const object = controller.userData.selected;
      object.material.emissive.b = 0;
      group.attach(object);
      controller.userData.selected = undefined;
    }
  }

  // レイと交差しているシェイプの一覧
  const intersected = [];

  // シェイプとコントローラのレイの交差判定のクリア
  function cleanIntersected() {
    while (intersected.length) {
      const object = intersected.pop();
      object.material.emissive.r = 0;
    }
  }

  // シェイプとコントローラのレイの交差判定
  function intersectObjects(controller) {
    // 選択時は無処理
    if (controller.userData.selected !== undefined) return;

    // 光線の取得
    const line = controller.getObjectByName("line");

    // レイと交差しているシェイプの取得
    const intersections = getIntersections(controller);

    if (intersections.length > 0) {
      // 交差時は赤くする
      const intersection = intersections[0];
      const object = intersection.object;
      object.material.emissive.r = 1;
      intersected.push(object);

      // 交差時は光線の長さをシェイプまでにする
      line.scale.z = intersection.distance;
    } else {
      // 光線の長さを固定長に戻す
      line.scale.z = 5;
    }
  }

  // ワーク行列
  const tempMatrix = new THREE.Matrix4();

  // レイキャスターの準備
  const raycaster = new THREE.Raycaster();

  // レイと交差しているシェイプの取得
  function getIntersections(controller) {
    tempMatrix.identity().extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
    return raycaster.intersectObjects(group.children, false);
  }

  // コントローラーイベントの処理
  function handleController(controller) {
    const userData = controller.userData;
    if (userData.isSelecting === true) {
      // コントローラーボタンが押された際の処理
      const cube = createCube();
      cube.position.set(
        Math.random() * -1000 - 300,  // x座標を-5から5の範囲でランダムに設定
        0,  // y座標
        Math.random() * -1000 - 300   // z座標を-5から5の範囲でランダムに設定
      );
      scene.add(cube);
    }
  }
  /* -------------------コントローラー設定 ここまで------------------- */



  /* -------------------ファイル読み込み ここから------------------- */
  loadCSVAndInit(fileName);
  
  // CSVファイルの読み込みとシーンの初期化
  function loadCSVAndInit(name) {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", name, true);
    xhr.onreadystatechange = function () {
      // XMLHttpRequestの状態が変わるたびに呼ばれるコールバック
      if (xhr.readyState == 4) {
        // リクエストが成功した場合
        if (xhr.status == 200) {
          // CSVデータを解析してエッジ情報を取得
          networkData = parseCSV(xhr.responseText);
          autoSetting(networkData);
          generateRandomNodePositions(networkData, nodePositions);
          if (networkData) {
            console.log(nodePositions);
            // ネットワークのノードとエッジを描画
            renderNetwork(networkData, group, camera, renderer, nodePositions);
          } else {
            console.error('Invalid CSV file format');
          }
          console.log(networkData);
        } else {
          console.error('Error loading the CSV file');
        }
      }
    };
    xhr.send();
  }

  /*  CSVデータの解析  */
  function parseCSV(content) {
    const lines = content.split('\n');
    const edges = [];

    // 各行のデータを解析してエッジ情報を構築
    for (const line of lines) {
      const [source, target, weight] = line.trim().split(',');

      if (source && target && weight) {
        edges.push({
          source: parseInt(source),
          target: parseInt(target),
          weight: parseFloat(weight)
        });
      }
    }
    // エッジ情報が存在する場合、その情報を返す
    return edges.length > 0 ?  edges  : null;
  }
  /* -------------------ファイル読み込み ここまで------------------- */



  /* -------------------座標生成 ここから------------------- */
  function createPositions() {
    // ランダムな座標を生成
    const position = {
      x: Math.random() * (max + 1 - min)  + min,
      y: Math.random() * (max + 1 - min)  + min,
      z: Math.random() * (max + 1 - min)  + min
    };

    // 生成したノードの座標を配列に追加
    nodePositions.push(position);

    // 生成したノードの座標を返す
    return position;
  }

  // 新しい座標を生成する関数
  function generateNewPosition(index, nodePosi, adjacencyMap) {
    const previousNodePosition = index > 0 ? nodePosi[index - 1] : { x: 0, y: 0, z: 0 };
    // 連結がない場合、ランダムに離す
    const randomDisplacement = adjacencyMap[index].length <= 1
      //ノードが孤立しているか、1つだけ連結している場合x、y、z 各成分は(Math.random() - 0.5) * 5の変位を加える。
      ? { x: (Math.random() - 0.5) * coefficient, y: (Math.random() - 0.5) * coefficient, z: (Math.random() - 0.5) * coefficient }
      //ノードが2つ以上連結している場合、変位を加えないようにする。
      : { x: 0, y: 0, z: 0 };

    const newPosition = {
      x: previousNodePosition.x + randomDisplacement.x,
      y: previousNodePosition.y + randomDisplacement.y,
      z: previousNodePosition.z + randomDisplacement.z
    };
    // nodePositions 配列の選択されたノードの位置も更新
    nodePositions[index] = newPosition;
  }

  // ランダムな座標を生成して nodePositions 配列に追加する関数
  function generateRandomNodePositions(edgesData,nodePosi) {
    const uniqueNodes = new Set();
    const nodePositions = new Map();

    // グラフのノードとエッジを作成
    edgesData.forEach(edge => {
      uniqueNodes.add(edge.source);
      uniqueNodes.add(edge.target);
    });

    // 各ノードの座標を保存
    uniqueNodes.forEach(node => {
      const position = createPositions();
      nodePositions.set(node, position);
    });

    //葉ノードの位置を修正
    const adjacencyMap = createAdjacencyMap(edgesData);
    Object.values(nodePosi).forEach((position, index) => {
      generateNewPosition(index, nodePosi , adjacencyMap);
    });
  }
  /* -------------------座標生成 ここまで------------------- */



  /* -------------------エッジ生成 ここから------------------- */
  function createEdge(sourcePosition, targetPosition, weight) {
    // ここにエッジの描画処理を追加
    const geometry = new THREE.BufferGeometry().setFromPoints([sourcePosition, targetPosition]);
    const material = new THREE.LineBasicMaterial({ color: 0xffffff });
    const edge = new THREE.Line(geometry, material);
    scene.add(edge);
  }

  function renderEdges(edgesData, scene, nodePositions) {
    edgesData.forEach(edge => {
      const sourcePosition = nodePositions[edge.source];
      const targetPosition = nodePositions[edge.target];

      if (sourcePosition && targetPosition) {
        createEdge(sourcePosition, targetPosition, edge.weight);
      }
    });
  }
  /* -------------------エッジ生成 ここまで------------------- */


  
  /* -------------------ネットワーク構造図の生成 ここから------------------- */
  function renderNetwork(edgesData, group, camera, renderer, nodePositions) {
    // ノードを作成
    const adjacencyMap = createAdjacencyMap(edgesData);
    Object.values(nodePositions).forEach((position, index) => {
      //ノードのジオメトリを作成
      let geometry;
      //ノードのマテリアルを作成
      let material;

      // 通常のノード
      if (adjacencyMap[index].length <= 1) {
        // 隣接していないノード
        geometry = new THREE.SphereGeometry(radius, 32, 32);
        material = new THREE.MeshLambertMaterial({ color: 0xffc0cb });
      } else {
        // 通常のノード
        geometry = new THREE.BoxGeometry(radius * 2.5, radius * 2.5, radius * 2.5);
        material = new THREE.MeshLambertMaterial({ color: 0x7fbfff });
      }

      const node = new THREE.Mesh(geometry, material);
      node.position.set(position.x, position.y, position.z);
      group.add(node);
    });
  
    // エッジを作成
    renderEdges(edgesData, scene, nodePositions);
  
    // レンダリングループ
    renderer.setAnimationLoop(() => {
      renderer.render(scene, camera);
    });
  }
  /* -------------------ネットワーク構造図の生成 ここまで------------------- */
  


  /* ------------------- 隣接リストを作成 ここから------------------- */
  function createAdjacencyMap(edgesData) {
    const adjacencyMap = new Array(nodePositions.length).fill(null).map(() => []);
    edgesData.forEach(edge => {
      adjacencyMap[edge.source].push(edge.target);
      adjacencyMap[edge.target].push(edge.source);
    });
    return adjacencyMap;
  }
  /* ------------------- 隣接リストを作成 ここまで------------------- */



  
  /* ------------------- リサイズ処理 ここから------------------- */
  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  /* ------------------- 隣接リストを作成 ここまで------------------- */



  /* -------------------座標の更新 ここから------------------- */
  // すべてのノードの位置を更新する関数
  function updateAllNode() {
    nodePositions.forEach((position, index) => {
      const newPosition = {
        x: Math.random() * (max + 1 - min) + min,
        y: Math.random() * (max + 1 - min) + min,
        z: Math.random() * (max + 1 - min) + min
      };

      const node = scene.children.find((child) => child instanceof THREE.Mesh && child.position.equals(position));
      if (node) {
        node.position.set(newPosition.x, newPosition.y, newPosition.z);
      }

      nodePositions[index] = newPosition;
      //console.log(index);
    });
    //ノードとエッジを消す
    clearScene();
    //変更されたノードの位置を再描画
    renderNetwork(networkData, group, camera, renderer, nodePositions);

    // レンダリング
    renderer.render(scene, camera);
  }

  // ランダムなノードの位置を更新して描画する関数
  function updateRandomNode() {
    // nodePositions 配列が空でないことを確認
    if (nodePositions.length > 0) {
      // ランダムなインデックスを選択
      const randomIndex = Math.floor(Math.random() * nodePositions.length);

      // 選択されたノードの位置を更新
      const newPosition = {
        x: Math.random() * (max + 1 - min) + min,
        y: Math.random() * (max + 1 - min) + min,
        z: Math.random() * (max + 1 - min) + min
      };

      // 選択されたノードを取得し、位置を更新
      const selectedNode = scene.children.find((child) => child instanceof THREE.Mesh &&
        child.position.equals(nodePositions[randomIndex]));

      if (selectedNode) {
        selectedNode.position.set(newPosition.x, newPosition.y, newPosition.z);
      }

      // nodePositions 配列の選択されたノードの位置も更新
      nodePositions[randomIndex] = newPosition;

      //ノードとエッジを消す
      clearScene();
      //変更されたノードの位置を再描画
      renderNetwork(networkData, group, camera, renderer, nodePositions);
      
      // レンダリング
      renderer.render(scene, camera);
    }
  }
  /* -------------------座標の更新 ここまで------------------- */



  /* -------------------ノード、エッジ削除 ここから------------------- */
  function clearScene() {
    // シーン内のすべての子要素（オブジェクト）を削除
    //1回で全削除されないため(deleteTimes)回繰り返し
    for (let i = 0; i < deleteTimes; i++) {
      // シーンにあるMesh、Lineをクリア
      scene.children.forEach((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
          scene.remove(child);
        }
      });

      // グループにあるMesh、Lineをクリア
      group.children.forEach((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
          group.remove(child);
        }
      });
    }

    // 再描画
    renderer.render(scene, camera);
  }
  /* -------------------ノード、エッジ削除 ここまで------------------- */



  /* -------------------自動設定 ここから------------------- */
  function autoSetting(edgesData){
    //範囲
    if(autoRangeSetting){
      max = edgesData.length/4;
      min = -max
    }

    //削除回数
    if(autodeleteSetting){
      deleteTimes = edgesData.length/2;
    }

    //半径
    if(autoRadius){
      if(edgesData.length <= 10){
        radius = 0.2;
      }else if(edgesData.length <= 100){
        radius = 0.4;
      }else{
        radius = 0.4 * edgesData.length/100;
      }
    }
    console.log('Max:',max,' , Min:', min,' , DeleteTimes:', deleteTimes,' , DeleteTimes:', radius);
  }
  /* -------------------自動設定 ここまで------------------- */


  
  /* -------------------キーボード操作設定 ここから------------------- */
  document.addEventListener('keydown', (event) => {
    if (event.key === 'r') {
      // 'r' キーが押されたときにランダムなノードの位置を更新して描画する関数
      updateRandomNode();
    }else if(event.key === 'a'){
      // 'a' キーが押されたときにすべてのノードの位置を更新する関数
      updateAllNode();
    }else if(event.key === 'p'){
      //'p' キーが押されたときにconsoleにノードの座標を表示する
      console.log(nodePositions);
    }else if(event.key === 'c'){
      // 'c' キーが押されたときにシーンをクリアする関数
      clearScene();
    }else if(event.key === 'n'){
      //'n' キーが押されたときに現在のノードの位置に描画する(消した後に戻す用)
      renderNetwork(networkData, group, camera, renderer, nodePositions);
    }
  });
  /* -------------------キーボード操作設定 ここまで------------------- */



  // 毎フレーム時に実行されるループイベント
  function tick() {
    cleanIntersected();
    intersectObjects(controller0);
    intersectObjects(controller1);
    
    handleController(controller1);
    handleController(controller0);
    // レンダリング
    renderer.render(scene, camera);
  }

  // レンダラーにループ関数を登録
  renderer.setAnimationLoop(tick);

  // リサイズ処理
  window.addEventListener("resize", onResize);
}
