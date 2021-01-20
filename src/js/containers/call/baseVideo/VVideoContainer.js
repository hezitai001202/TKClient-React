/**
 * 视频显示部分-底部和右侧所有视频组件的Smart模块
 * @module BaseVideoSmart
 * @description 承载 一对一 老师和学生视频展示
 * @author xiagd
 * @date 2017/08/11
 */

'use strict';
import React from 'react';
import ServiceRoom from 'ServiceRoom' ;
import TkGlobal from 'TkGlobal';
import TkUtils from 'TkUtils';
import CoreController from 'CoreController';
import TkConstant from "TkConstant";
import ServiceSignalling from "ServiceSignalling";
import eventObjectDefine from 'eventObjectDefine';
import CommonVideoSmart from "./commonVideoSmart";

class VVideoContainer extends React.Component{
    constructor(props){
        super(props);
        this.state={
            pictureInPictureClassnameFromTeacherStream:undefined ,
            pictureInPictureClassnameFromStudentStream:undefined ,
            teacherStream:undefined,
            studentStream:undefined,
            areaExchangeFlag: false,
            isHasCloseBtn: false,   //是否拥有关闭按钮
        };
        this.listernerBackupid = new Date().getTime()+'_'+Math.random() ;
        this.mainPictureInPictureStreamRole = undefined ;
        this.fullScreenType = undefined ;
        this.foregroundpicUrl = undefined ;
        this.tmediaFlagObj = {videoFlag : false,audioFlag : false};
        this.smediaFlagObj = {videoFlag : false,audioFlag : false};
    };

    componentDidMount() { //在完成首次渲染之前调用，此时仍可以修改组件的state
        eventObjectDefine.CoreController.addEventListener(TkConstant.EVENTTYPE.RoomEvent.roomUservideostateChanged,this._controlRemoteStreamFlag.bind(this,'Video'), this.listernerBackupid);
        eventObjectDefine.CoreController.addEventListener(TkConstant.EVENTTYPE.RoomEvent.roomUseraudiostateChanged,this._controlRemoteStreamFlag.bind(this,'Audio'), this.listernerBackupid);
        eventObjectDefine.CoreController.addEventListener(TkConstant.EVENTTYPE.RoomEvent.roomParticipantLeave,this.handlerRoomParticipantLeave.bind(this), this.listernerBackupid);
        eventObjectDefine.CoreController.addEventListener(TkConstant.EVENTTYPE.RoomEvent.roomConnected, this.handlerRoomConnected.bind(this)  , this.listernerBackupid ); //Room-Connected事件：房间连接事件
        eventObjectDefine.CoreController.addEventListener(TkConstant.EVENTTYPE.RoomEvent.roomDisconnected,this.handlerRoomDisconnected.bind(this) , this.listernerBackupid); //Disconnected事件：失去连接事件
        eventObjectDefine.CoreController.addEventListener( TkConstant.EVENTTYPE.RoomEvent.roomDelmsg , this.handlerRoomDelmsg.bind(this), this.listernerBackupid); //roomDelmsg事件 下课事件 classBegin
        eventObjectDefine.CoreController.addEventListener( TkConstant.EVENTTYPE.RoomEvent.roomPubmsg , this.handlerRoomPubmsg.bind(this), this.listernerBackupid); //roomPubmsg事件  上课事件 classBegin
        eventObjectDefine.CoreController.addEventListener( 'endClassbeginShowLocalStream', this.handlerEndClassbeginShowLocalStream.bind(this), this.listernerBackupid);
        eventObjectDefine.CoreController.addEventListener( "receive-msglist-ClassBegin" , this.handlerReceiveMsglistClassBegin.bind(this), this.listernerBackupid);
        eventObjectDefine.CoreController.addEventListener( "receive-msglist-FullScreen" , this.handlerReceiveMsglistFullScreen.bind(this), this.listernerBackupid);
    };

    componentWillUnmount() { //组件被移除之前被调用，可以用于做一些清理工作，在componentDidMount方法中添加的所有任务都需要在该方法中撤销，比如创建的定时器或添加的事件监听器
        eventObjectDefine.CoreController.removeBackupListerner(this.listernerBackupid);
    };
    handlerEndClassbeginShowLocalStream(){
        if(TkConstant.joinRoomInfo.isClassOverNotLeave || ( !TkConstant.joinRoomInfo.isClassOverNotLeave && TkConstant.joinRoomInfo.isBeforeClassReleaseVideo )){
            return;
        }
        setTimeout(  () => {
            if(CoreController.handler.getAppPermissions('endClassbeginShowLocalStream')  ) { //下课后显示本地视频权限,并且是老师
                if( (TkConstant.hasRole.roleChairman && !this.state.teacherStream) || (TkConstant.hasRole.roleStudent && !this.state.studentStream) ){
                    this._addLocalStreamToVideoContainer();
                }
            }
        }, 250);
    };

    isTeacher(userID){
        let user = this.getUser(userID);
        if(!user){L.Logger.warning('[vv->isTeacher]user is not exist  , user id:'+userID+'!');} ;
        if (user && user.role === TkConstant.role.roleChairman) {
            return true;
        }
        return false;
    }

    handlerRoomConnected(roomEvent) {
        if(TkGlobal.classBegin || (!TkGlobal.classBegin && TkConstant.joinRoomInfo.autoClassBegin && TkConstant.hasRole.roleChairman && CoreController.handler.getAppPermissions('autoClassBegin') ) ){ //如果上课了或者自动上课，不生成本地流
            return;
        }
        if(  !TkConstant.hasRoomtype.oneToOne && TkConstant.hasRole.roleChairman ){
            this._addLocalStreamToVideoContainer();
        }else if( (TkConstant.hasRoomtype.oneToOne ) ){
            this._addLocalStreamToVideoContainer();
        }
    }

    handlerRoomParticipantLeave(handleData){
        let userId = handleData.userId;
        if(this.state.teacherStream && this.state.teacherStream.extensionId === userId){
            this.setState({
                teacherStream:undefined ,
            });
        }else if(this.state.studentStream && this.state.studentStream.extensionId === userId){
            this.setState({
                studentStream:undefined ,
            });
        }
    }
   
    handlerRoomDisconnected(recvEventData){
        this._clearAllStream();
    };

    handlerRoomDelmsg(recvEventData){
        let delmsgData = recvEventData.message ;
        switch(delmsgData.name) {
            case "ClassBegin":
                if(TkConstant.joinRoomInfo.isClassOverNotLeave || ( !TkConstant.joinRoomInfo.isClassOverNotLeave && TkConstant.joinRoomInfo.isBeforeClassReleaseVideo )){
                    return;
                }
                this._clearAllStream();              
                setTimeout(  () => {
                    if( CoreController.handler.getAppPermissions('endClassbeginShowLocalStream')  ) { //下课后显示本地视频权限,并且是老师
                        if( (TkConstant.hasRole.roleChairman && !this.state.teacherStream) || (TkConstant.hasRole.roleStudent && !this.state.studentStream) ){
                            this._addLocalStreamToVideoContainer();
                        }
                    }
                }, 250);
                break;
            case "FullScreen":
                this.mainPictureInPictureStreamRole = undefined ;
                this.fullScreenType = undefined;
                this.foregroundpicUrl = undefined ;
                this.setState({pictureInPictureClassnameFromTeacherStream:undefined,isHasCloseBtn:false});
                this.setState({pictureInPictureClassnameFromStudentStream:undefined});
                break;
        }
    }

    videoOnDoubleClick(stream , source , event){ //双击视频全屏
        if(! CoreController.handler.getAppPermissions('dblclickDeviceVideoFullScreenRight')){return ; } ;
        let _launchFullscreenToVideo = ()=>{
            if( TkUtils.tool.isFullScreenStatus() ) {
                TkUtils.tool.exitFullscreen();
            }else{
                if(stream){
                    let targetVideo = document.getElementById('vvideo'+stream.extensionId);
                    if(targetVideo){
                        TkUtils.tool.launchFullscreen(targetVideo);
                    }
                }
            }
        };
        if(TkGlobal.classBegin){
            if( CoreController.handler.getAppPermissions('pictureInPicture') ){
                if(source === 'studentStream' && this.mainPictureInPictureStreamRole === undefined){ //双击的是学生的视频，并且没有画中画
                    if(stream){
                        _launchFullscreenToVideo();
                    }else{
                        return ;
                    }
                }else if(source === 'teacherStream' && this.mainPictureInPictureStreamRole === undefined && !stream){ //老师没有开启视频时，双击视频窗无效，不开启全屏
                    return ;
                }else{
                    if(this.fullScreenType === undefined){
                        let data = {
                            fullScreenType:'stream_video' ,
                            needPictureInPictureSmall:true ,
                            mainPictureInPictureStreamRoleStreamRole:(source === 'teacherStream'? TkConstant.role.roleChairman:TkConstant.role.roleStudent),
                            fullScreenStreamExtensionId:stream?stream.extensionId:''
                        };
                        let isDelMsg = false ;
                        ServiceSignalling.sendSignallingFromFullScreen(data , isDelMsg);
                    }else if(this.fullScreenType === 'stream_video'){
                        if( (source === 'teacherStream' && this.mainPictureInPictureStreamRole === TkConstant.role.roleChairman) || (source === 'studentStream' && this.mainPictureInPictureStreamRole === TkConstant.role.roleStudent)  ) {
                            ServiceSignalling.sendSignallingFromFullScreen({} , true);
                        }else{
                            let mimeticPubmsgData = {  //模拟的FullScreen信令数据
                                data:{
                                    fullScreenType:this.fullScreenType ,
                                    needPictureInPictureSmall:true ,
                                    mainPictureInPictureStreamRoleStreamRole:this.mainPictureInPictureStreamRole === TkConstant.role.roleChairman ? TkConstant.role.roleStudent:TkConstant.role.roleChairman,
                                    fullScreenStreamExtensionId:this.fullScreenStreamExtensionId
                                }
                            };
                            this._handlerSignallingFullScreen(mimeticPubmsgData ); //本地切换,不是远程数据控制
                        }
                    }
                }
            }else{
                if( (source === 'teacherStream' &&  this.state.pictureInPictureClassnameFromTeacherStream === undefined) || (source === 'studentStream' &&  this.state.pictureInPictureClassnameFromStudentStream === undefined)  ){
                    _launchFullscreenToVideo();
                }
            }
        }
        if(event){
            event.preventDefault();
            event.stopPropagation();
        }
        return false ;
    };


    handlerReceiveMsglistClassBegin(recvEventData){
        if(TkGlobal.playback ){//是直播或者回放不需要移除数据流
            return ;
        }
        this._clearAllLocalStream();
    }

    handlerReceiveMsglistFullScreen(recvEventData){
        let {FullScreenArray} = recvEventData.message ;
        this._handlerSignallingFullScreen(FullScreenArray[0]);
    };

    handlerRoomPubmsg(recvEventData){
        let pubmsgData = recvEventData.message;
        switch(pubmsgData.name) {
            case "ClassBegin":
                if(TkGlobal.playback ){//是直播或者回放不需要移除数据流
                    return ;
                }
                // 清空音视频流
                this._clearAllLocalStream();
                break;
            case "FullScreen":
                this._handlerSignallingFullScreen(pubmsgData);
                break;
        }
    };
    
    getUser(userid){
        if( !ServiceRoom.getTkRoom() ){
            return undefined ;
        }
        return ServiceRoom.getTkRoom().getUser(userid);
    }
    
    /*添加本地视频流到容器中*/
    _addLocalStreamToVideoContainer(){
        if(TkGlobal.isLeaveRoom){
            return ;
        }
        if(CoreController.handler.getAppPermissions('localStream') ){
            let userID = ServiceRoom.getTkRoom().getMySelf().id;
            if( TkConstant.hasRole.roleChairman){
                this.setState({
                    teacherStream: {extensionId:userID,mediaFlagObj:{videoFlag : true,audioFlag : true},type:'video'}
                });
            }else if( TkConstant.hasRole.roleStudent) {
                this.setState({
                    studentStream: {extensionId:userID,mediaFlagObj:{videoFlag : true,audioFlag : true},type:'video'}
                });
            }
        }
    };
    
    /*添加远程视频流到容器中*/
    /*_controlRemoteStreamVideo(or,event){
        let {message} = event;
        if(this.isTeacher(message.userId) === true){
            this.setState({
                teacherStream: {extensionId:message.userId,published:message.message,type:message.type}
            });
        }else if(this.getUser(message.userId) && this.getUser(message.userId).role ===TkConstant.role.roleStudent){
            this.setState({
                studentStream: {extensionId:message.userId,published:message.message,type:message.type}
            });
        }
    }*/
    /*改变音视频是否发布*/
    _controlRemoteStreamFlag(or,event) {
        let {message} = event;
        if (message.type !== 'video') {
            return;
        }
        if (or === 'Video') {
            if (this.isTeacher(message.userId) === true) {
                this.tmediaFlagObj.videoFlag = message.published;
                this.setState({
                    teacherStream: {
                        extensionId: message.userId,
                        mediaFlagObj: Object.customAssign({}, this.tmediaFlagObj),
                        type: message.type
                    }
                });
            } else if (this.getUser(message.userId) && this.getUser(message.userId).role === TkConstant.role.roleStudent) {
                this.smediaFlagObj.videoFlag = message.published;
                this.setState({
                    studentStream: {
                        extensionId: message.userId,
                        mediaFlagObj: Object.customAssign({}, this.smediaFlagObj),
                        type: message.type
                    }
                });
            }
        } else if (or === 'Audio') {
            if (this.isTeacher(message.userId) === true) {
                this.tmediaFlagObj.audioFlag = message.published;
                this.setState({
                    teacherStream: {
                        extensionId: message.userId,
                        mediaFlagObj: Object.customAssign({}, this.tmediaFlagObj),
                        type: message.type
                    }
                });
            } else if (this.getUser(message.userId) && this.getUser(message.userId).role === TkConstant.role.roleStudent) {
                this.smediaFlagObj.audioFlag = message.published;
                this.setState({
                    studentStream: {
                        extensionId: message.userId,
                        mediaFlagObj: Object.customAssign({}, this.smediaFlagObj),
                        type: message.type
                    }
                });
            }
        }
        if (this.tmediaFlagObj.videoFlag === false && this.tmediaFlagObj.audioFlag === false) {
            if (ServiceRoom.getTkRoom().getUser(message.userId) && (ServiceRoom.getTkRoom().getUser(message.userId).publishstate !== TkConstant.PUBLISHSTATE.PUBLISH_STATE_MUTEALL)) {
                if(this.fullScreenType === 'stream_video' &&  this.fullScreenStreamExtensionId === this.state.teacherStream.extensionId){
                    ServiceSignalling.sendSignallingFromFullScreen({} , true);  //TODO 20180722:qiu 这里会导致每个人都发送一次，虽然是1：1，但是还是需要优化，否则后期出现其它需求可能会导致问题
                }
                if (this.isTeacher(message.userId) === true) {
                    this.setState({
                        teacherStream: undefined
                    });
                }
            }
        }else if(this.smediaFlagObj.videoFlag === false && this.smediaFlagObj.audioFlag === false){
            if (ServiceRoom.getTkRoom().getUser(message.userId) && (ServiceRoom.getTkRoom().getUser(message.userId).publishstate !== TkConstant.PUBLISHSTATE.PUBLISH_STATE_MUTEALL)) {
                if (this.getUser(message.userId) && this.getUser(message.userId).role === TkConstant.role.roleStudent) {
                    this.setState({
                        studentStream: undefined
                    });
                }
            }
        }
    }
    
    /*清空所有的视频流*/
    _clearAllStream(){
        this.setState({ // 清空音视频流
            teacherStream:undefined ,
            studentStream:undefined,
        });
    };

    /*清空所有的本地视频流*/
    _clearAllLocalStream(){
        if(this.state.teacherStream && this.state.teacherStream.local && this.state.teacherStream.getID() === 'local'){
            this.setState({ teacherStream:undefined });
        }
        if(this.state.studentStream && this.state.studentStream.local && this.state.studentStream.getID() === 'local'){
            this.setState({ studentStream:undefined });
        }
    };

    /*处理信令FullScreen*/
    _handlerSignallingFullScreen(pubmsgData){
        this.fullScreenType = pubmsgData.data.fullScreenType;
        this.foregroundpicUrl = undefined ;
        this.fullScreenStreamExtensionId = undefined ;
        if(TkConstant.hasRoomtype.oneToOne){
            switch (pubmsgData.data.fullScreenType){
                case 'stream_video':
                    this.fullScreenStreamExtensionId = pubmsgData.data.fullScreenStreamExtensionId ;
                    if(TkConstant.hasRole.roleStudent){
                        this.mainPictureInPictureStreamRole = TkConstant.role.roleChairman;
                        this.foregroundpicUrl =  window.WBGlobal.nowUseDocAddress + TkConstant.joinRoomInfo.foregroundpic ;
                        this.setState({pictureInPictureClassnameFromTeacherStream:'pictureInPicture big '+pubmsgData.data.fullScreenType});
                        this.setState({pictureInPictureClassnameFromStudentStream:undefined});
                    }else{
                        if(pubmsgData.data.mainPictureInPictureStreamRoleStreamRole === TkConstant.role.roleChairman){
                            this.mainPictureInPictureStreamRole = pubmsgData.data.mainPictureInPictureStreamRoleStreamRole ;
                            this.setState({pictureInPictureClassnameFromTeacherStream:'pictureInPicture big '+pubmsgData.data.fullScreenType});
                            if(pubmsgData.data.needPictureInPictureSmall){
                                this.setState({pictureInPictureClassnameFromStudentStream:'pictureInPicture small '+pubmsgData.data.fullScreenType});
                            }else{
                                this.setState({pictureInPictureClassnameFromStudentStream:undefined});
                            }
                        }else if( pubmsgData.data.mainPictureInPictureStreamRoleStreamRole === TkConstant.role.roleStudent ){
                            this.mainPictureInPictureStreamRole = pubmsgData.data.mainPictureInPictureStreamRoleStreamRole ;
                            this.setState({pictureInPictureClassnameFromStudentStream:'pictureInPicture big '+pubmsgData.data.fullScreenType});
                            if(pubmsgData.data.needPictureInPictureSmall){
                                this.setState({pictureInPictureClassnameFromTeacherStream:'pictureInPicture small '+pubmsgData.data.fullScreenType,isHasCloseBtn:true});
                            }else{
                                this.setState({pictureInPictureClassnameFromTeacherStream:undefined,isHasCloseBtn:false});
                            }
                        }
                    }
                    break;
                default:
                    if(pubmsgData.data.needPictureInPictureSmall){
                        if(TkConstant.hasRole.roleChairman || TkConstant.hasRole.roleTeachingAssistant){
                            this.mainPictureInPictureStreamRole = undefined;
                            this.setState({pictureInPictureClassnameFromTeacherStream:undefined,isHasCloseBtn:false});
                            this.setState({pictureInPictureClassnameFromStudentStream:'pictureInPicture small '+pubmsgData.data.fullScreenType});
                        }else{
                            this.mainPictureInPictureStreamRole = undefined;
                            this.setState({pictureInPictureClassnameFromStudentStream:undefined});
                            this.setState({pictureInPictureClassnameFromTeacherStream:'pictureInPicture small '+pubmsgData.data.fullScreenType,isHasCloseBtn:true});
                        }
                    }else{
                        let fullElement = document.getElementById("all_root");
                        TkUtils.tool.launchFullscreen( fullElement );
                    }
                    break;
            }
        }else{
            if(pubmsgData.data.needPictureInPictureSmall){
                this.setState({pictureInPictureClassnameFromTeacherStream:'pictureInPicture small ' + pubmsgData.data.fullScreenType,isHasCloseBtn:true});
            }else{
                let fullElement = document.getElementById("all_root");
                TkUtils.tool.launchFullscreen( fullElement );
            }
        }
        
    };

    // 隐藏课件全屏之后的视频
    closeFullScreenVideo(){
        this.setState({pictureInPictureClassnameFromTeacherStream:undefined,isHasCloseBtn:false});
    }
    render(){
        return (
            <div
                id={this.props.id || 'participants'}
                className={ "clear-float video-participants-vessel " + (this.state.areaExchangeFlag ? ' areaExchange' : '') + (!TkConstant.hasRoomtype.oneToOne ? 'teacherVideo' : undefined)}
                style={{display:TkGlobal.doubleScreen?"none":""}}>
                    <CommonVideoSmart
                        RightContentVesselSmartStyleJson={this.props.RightContentVesselSmartStyleJson}
                        hasDragJurisdiction = {false}
                        videoDumbClassName={"vvideo"}
                        direction={'vertical'}
                        mainPictureInPictureStreamRole={this.mainPictureInPictureStreamRole}
                        foregroundpicUrl={this.foregroundpicUrl}
                        videoOnDoubleClick={this.videoOnDoubleClick.bind(this , this.state.teacherStream , 'teacherStream')} pictureInPictureClassname={this.state.pictureInPictureClassnameFromTeacherStream}
                        className={"video-chairman-wrap"}
                        stream={this.state.teacherStream}
                        id={this.state.teacherStream?this.state.teacherStream.extensionId:undefined}
                        closeFullScreenVideo={this.state.isHasCloseBtn ? this.closeFullScreenVideo.bind(this) : undefined}
                        isHasCloseBtn={this.state.isHasCloseBtn}
                        />
                    
                    {TkConstant.hasRoomtype.oneToOne
                        ?<CommonVideoSmart
                            RightContentVesselSmartStyleJson={this.props.RightContentVesselSmartStyleJson}
                            hasDragJurisdiction = {false}
                            videoDumbClassName={"vvideo"}
                            direction={'vertical'}
                            mainPictureInPictureStreamRole={this.mainPictureInPictureStreamRole}
                            foregroundpicUrl={this.foregroundpicUrl}
                            videoOnDoubleClick={this.videoOnDoubleClick.bind(this , this.state.studentStream ,'studentStream')} pictureInPictureClassname={this.state.pictureInPictureClassnameFromStudentStream}
                            className={"video-hearer-wrap"}
                            stream={this.state.studentStream}
                            id={this.state.studentStream?this.state.studentStream.extensionId:undefined}/>
                        :undefined }
            </div>
        )
    };
};

export default  VVideoContainer;